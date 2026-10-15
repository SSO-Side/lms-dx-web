"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { EnrollmentStatus, SubmissionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireCohortAccess, AccessDeniedError } from "@/lib/access/requireCohortAccess";
import { isYmd, ymdToDate, formatDateTime } from "@/lib/dates";

type Result = { ok: true; id?: number } | { ok: false; error: string };

async function wrap(fn: () => Promise<Result>): Promise<Result> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AccessDeniedError) return { ok: false, error: "권한이 없습니다." };
    throw e;
  }
}

const refresh = (cohortId: number) => {
  revalidatePath(`/app/c/${cohortId}/curriculum`);
  revalidatePath(`/app/c/${cohortId}`);
};

const httpUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, "http(s)로 시작하는 올바른 링크를 입력해 주세요.");

const firstError = (e: z.ZodError) => e.issues[0]?.message ?? "입력값을 확인해 주세요.";

export async function createWeekAction(cohortId: number, input: { title: string }): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "material:write");
    const parsed = z.object({ title: z.string().trim().min(1, "주차 제목을 입력해 주세요.").max(200) }).safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const last = await db.week.findFirst({ where: { cohortId: ctx.cohortId }, orderBy: { weekNo: "desc" }, select: { weekNo: true } });
    const week = await db.week.create({ data: { cohortId: ctx.cohortId, weekNo: (last?.weekNo ?? 0) + 1, title: parsed.data.title } });
    refresh(ctx.cohortId);
    return { ok: true, id: week.id };
  });
}

const lessonSchema = z.object({
  weekId: z.number().int(),
  date: z.string().refine(isYmd, "수업 날짜를 선택해 주세요."),
  title: z.string().trim().min(1, "수업명을 입력해 주세요.").max(200),
});

export async function createLessonAction(cohortId: number, input: z.input<typeof lessonSchema>): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "material:write");
    const parsed = lessonSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const week = await db.week.findFirst({ where: { id: parsed.data.weekId, cohortId: ctx.cohortId } });
    if (!week) return { ok: false, error: "주차를 찾을 수 없습니다." };
    const lesson = await db.lesson.create({
      data: {
        cohortId: ctx.cohortId,
        weekId: week.id,
        date: ymdToDate(parsed.data.date),
        title: parsed.data.title,
        instructorId: ctx.role === "INSTRUCTOR" ? ctx.user.id : null,
      },
    });
    refresh(ctx.cohortId);
    return { ok: true, id: lesson.id };
  });
}

const materialSchema = z.object({
  lessonId: z.number().int(),
  type: z.enum(["DOC", "FILE", "REPO", "GUIDE"]),
  title: z.string().trim().min(1, "자료 제목을 입력해 주세요.").max(200),
  url: httpUrl,
  tags: z.array(z.string().trim().min(1).max(30)).max(10),
});

export async function createMaterialAction(cohortId: number, input: z.input<typeof materialSchema>): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "material:write");
    const parsed = materialSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const lesson = await db.lesson.findFirst({ where: { id: parsed.data.lessonId, cohortId: ctx.cohortId } });
    if (!lesson) return { ok: false, error: "수업을 찾을 수 없습니다." };
    const m = await db.material.create({
      data: {
        cohortId: ctx.cohortId,
        lessonId: lesson.id,
        type: parsed.data.type,
        title: parsed.data.title,
        url: parsed.data.url,
        tags: parsed.data.tags,
        createdById: ctx.user.id,
      },
    });
    refresh(ctx.cohortId);
    return { ok: true, id: m.id };
  });
}

export async function deleteMaterialAction(cohortId: number, materialId: number): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "material:write");
    const res = await db.material.deleteMany({ where: { id: materialId, cohortId: ctx.cohortId } });
    if (res.count === 0) return { ok: false, error: "자료를 찾을 수 없습니다." };
    refresh(ctx.cohortId);
    return { ok: true };
  });
}

const assignmentSchema = z.object({
  lessonId: z.number().int(),
  title: z.string().trim().min(1, "과제 제목을 입력해 주세요.").max(200),
  description: z.string().trim().max(5000).optional(),
  /** "YYYY-MM-DDTHH:mm" (Asia/Seoul) */
  dueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "마감 일시를 입력해 주세요."),
});

export async function createAssignmentAction(cohortId: number, input: z.input<typeof assignmentSchema>): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "assignment:write");
    const parsed = assignmentSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const lesson = await db.lesson.findFirst({ where: { id: parsed.data.lessonId, cohortId: ctx.cohortId } });
    if (!lesson) return { ok: false, error: "수업을 찾을 수 없습니다." };
    const dueAt = new Date(`${parsed.data.dueAt}:00+09:00`);
    if (isNaN(dueAt.getTime())) return { ok: false, error: "마감 일시가 올바르지 않습니다." };
    const a = await db.assignment.create({
      data: { cohortId: ctx.cohortId, lessonId: lesson.id, title: parsed.data.title, description: parsed.data.description || null, dueAt },
    });
    refresh(ctx.cohortId);
    return { ok: true, id: a.id };
  });
}

export async function deleteAssignmentAction(cohortId: number, assignmentId: number): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "assignment:write");
    const a = await db.assignment.findFirst({
      where: { id: assignmentId, cohortId: ctx.cohortId },
      include: { _count: { select: { submissions: true } } },
    });
    if (!a) return { ok: false, error: "과제를 찾을 수 없습니다." };
    if (a._count.submissions > 0) return { ok: false, error: "제출물이 있는 과제는 삭제할 수 없습니다." };
    await db.assignment.delete({ where: { id: a.id } });
    refresh(ctx.cohortId);
    return { ok: true };
  });
}

/** 과제 제출 (수강생 본인). 다시 제출하면 덮어쓴다. 파일 업로드는 후속(storage 위에서) — 지금은 링크만. */
export async function submitAssignmentAction(cohortId: number, input: { assignmentId: number; linkUrl: string }): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "submission:create");
    const parsed = z.object({ assignmentId: z.number().int(), linkUrl: httpUrl }).safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const [a, enrollment] = await Promise.all([
      db.assignment.findFirst({ where: { id: parsed.data.assignmentId, cohortId: ctx.cohortId } }),
      db.enrollment.findUnique({ where: { cohortId_studentId: { cohortId: ctx.cohortId, studentId: ctx.user.id } } }),
    ]);
    if (!a) return { ok: false, error: "과제를 찾을 수 없습니다." };
    if (ctx.role !== "ADMIN" && enrollment?.status !== EnrollmentStatus.ENROLLED) return { ok: false, error: "재적 수강생만 제출할 수 있습니다." };

    const now = new Date();
    const status = now > a.dueAt ? SubmissionStatus.LATE : SubmissionStatus.SUBMITTED;
    await db.submission.upsert({
      where: { assignmentId_studentId: { assignmentId: a.id, studentId: ctx.user.id } },
      create: { cohortId: ctx.cohortId, assignmentId: a.id, studentId: ctx.user.id, linkUrl: parsed.data.linkUrl, status, submittedAt: now },
      update: { linkUrl: parsed.data.linkUrl, status, submittedAt: now },
    });
    refresh(ctx.cohortId);
    return { ok: true };
  });
}

/** 제출 현황 (교사·매니저). 재적 수강생 전원 기준. */
export async function getSubmissionStatusAction(cohortId: number, assignmentId: number) {
  try {
    const ctx = await requireCohortAccess(cohortId, "assignment:read");
    if (ctx.role === "STUDENT") return { ok: false as const, error: "권한이 없습니다." };
    const a = await db.assignment.findFirst({ where: { id: assignmentId, cohortId: ctx.cohortId } });
    if (!a) return { ok: false as const, error: "과제를 찾을 수 없습니다." };
    const [students, subs] = await Promise.all([
      db.enrollment.findMany({
        where: { cohortId: ctx.cohortId, status: EnrollmentStatus.ENROLLED },
        include: { student: { select: { id: true, name: true, loginId: true } } },
        orderBy: { student: { name: "asc" } },
      }),
      db.submission.findMany({ where: { cohortId: ctx.cohortId, assignmentId: a.id } }),
    ]);
    return {
      ok: true as const,
      rows: students.map((e) => {
        const s = subs.find((x) => x.studentId === e.studentId);
        return {
          studentId: e.studentId,
          name: e.student.name,
          loginId: e.student.loginId,
          status: s?.status ?? null,
          linkUrl: s?.linkUrl ?? null,
          submittedAt: s ? formatDateTime(s.submittedAt) : null,
        };
      }),
    };
  } catch (e) {
    if (e instanceof AccessDeniedError) return { ok: false as const, error: "권한이 없습니다." };
    throw e;
  }
}
