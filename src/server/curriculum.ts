"use server";

// 커리큘럼 서버 액션: 주차·수업·자료·과제 등록/삭제, 과제 제출(링크·파일), 제출 현황.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { EnrollmentStatus, SubmissionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireCohortAccess, AccessDeniedError } from "@/lib/access/requireCohortAccess";
import { isYmd, ymdToDate, formatDateTime } from "@/lib/dates";
import { checkCourseFile, safeFileName, saveFile, deleteFile } from "@/lib/storage";

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

type StoredFile = { filePath: string; fileName: string; fileMime: string; fileSize: number };

/** FormData의 file 항목 검증 후 저장. 파일이 없으면 null, 오류면 문구. 저장 키 접두어는 "종류/반ID". */
async function storeCourseFile(prefix: string, formData: FormData): Promise<StoredFile | string | null> {
  const file = formData.get("file");
  if (!file || typeof file !== "object" || file.size === 0) return null;
  const data = Buffer.from(await file.arrayBuffer());
  const checked = checkCourseFile(file, data);
  if (typeof checked === "string") return checked;
  const filePath = await saveFile(prefix, data, checked.ext, checked.mime);
  return { filePath, fileName: safeFileName(file.name), fileMime: checked.mime, fileSize: file.size };
}

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
};

/** 주차 추가(번호는 마지막 + 1). */
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

/** 주차에 수업 추가. */
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
  lessonId: z.coerce.number().int(),
  source: z.enum(["link", "file"]),
  type: z.enum(["DOC", "FILE", "REPO", "GUIDE"]),
  title: z.string().trim().min(1, "자료 제목을 입력해 주세요.").max(200),
  tags: z.array(z.string().trim().min(1).max(30)).max(10),
});

/** 자료 등록. source=link면 url, source=file이면 file(FormData)을 받는다. 파일 자료의 종류는 FILE로 고정. */
export async function createMaterialAction(cohortId: number, formData: FormData): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "material:write");
    const parsed = materialSchema.safeParse({
      lessonId: str(formData, "lessonId"),
      source: str(formData, "source") || "link",
      type: str(formData, "type") || "DOC",
      title: str(formData, "title"),
      tags: str(formData, "tags")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const lesson = await db.lesson.findFirst({ where: { id: parsed.data.lessonId, cohortId: ctx.cohortId } });
    if (!lesson) return { ok: false, error: "수업을 찾을 수 없습니다." };

    let url: string | null = null;
    let stored: StoredFile | null = null;
    if (parsed.data.source === "link") {
      const u = httpUrl.safeParse(str(formData, "url"));
      if (!u.success) return { ok: false, error: firstError(u.error) };
      url = u.data;
    } else {
      const r = await storeCourseFile(`materials/${ctx.cohortId}`, formData);
      if (r === null) return { ok: false, error: "올릴 파일을 선택해 주세요." };
      if (typeof r === "string") return { ok: false, error: r };
      stored = r;
    }

    try {
      const m = await db.material.create({
        data: {
          cohortId: ctx.cohortId,
          lessonId: lesson.id,
          type: stored ? "FILE" : parsed.data.type,
          title: parsed.data.title,
          url,
          ...stored,
          tags: parsed.data.tags,
          createdById: ctx.user.id,
        },
      });
      refresh(ctx.cohortId);
      return { ok: true, id: m.id };
    } catch (e) {
      if (stored) await deleteFile(stored.filePath);
      throw e;
    }
  });
}

/** 자료 삭제(파일 자료면 저장된 파일도 지운다). */
export async function deleteMaterialAction(cohortId: number, materialId: number): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "material:write");
    const m = await db.material.findFirst({ where: { id: materialId, cohortId: ctx.cohortId }, select: { id: true, filePath: true } });
    if (!m) return { ok: false, error: "자료를 찾을 수 없습니다." };
    await db.material.delete({ where: { id: m.id } });
    if (m.filePath) await deleteFile(m.filePath);
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

/** 수업에 과제 추가(마감 일시는 한국 시간 기준). */
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

/** 과제 삭제. 제출물이 있으면 막는다. */
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

/**
 * 과제 제출 (수강생 본인, FormData: assignmentId·linkUrl·file). 링크·파일 중 하나 이상 필요.
 * 다시 제출하면 덮어쓴다: 새 파일을 올리면 이전 파일을 지우고, 안 올리면 이전 파일을 유지한다. 링크는 입력값으로 바뀐다(비우면 삭제).
 */
export async function submitAssignmentAction(cohortId: number, formData: FormData): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "submission:create");
    const assignmentId = parseInt(str(formData, "assignmentId"), 10);
    const rawLink = str(formData, "linkUrl").trim();
    let linkUrl: string | null = null;
    if (rawLink) {
      const u = httpUrl.safeParse(rawLink);
      if (!u.success) return { ok: false, error: firstError(u.error) };
      linkUrl = u.data;
    }
    const [a, enrollment] = await Promise.all([
      db.assignment.findFirst({ where: { id: assignmentId || -1, cohortId: ctx.cohortId } }),
      db.enrollment.findUnique({ where: { cohortId_studentId: { cohortId: ctx.cohortId, studentId: ctx.user.id } } }),
    ]);
    if (!a) return { ok: false, error: "과제를 찾을 수 없습니다." };
    if (ctx.role !== "ADMIN" && enrollment?.status !== EnrollmentStatus.ENROLLED) return { ok: false, error: "재적 수강생만 제출할 수 있습니다." };

    const prev = await db.submission.findUnique({
      where: { assignmentId_studentId: { assignmentId: a.id, studentId: ctx.user.id } },
      select: { filePath: true },
    });
    const stored = await storeCourseFile(`submissions/${ctx.cohortId}`, formData);
    if (typeof stored === "string") return { ok: false, error: stored };
    if (!linkUrl && !stored && !prev?.filePath) return { ok: false, error: "제출할 링크나 파일을 넣어 주세요." };

    const now = new Date();
    const status = now > a.dueAt ? SubmissionStatus.LATE : SubmissionStatus.SUBMITTED;
    const fields = { linkUrl, status, submittedAt: now, ...stored };
    try {
      await db.submission.upsert({
        where: { assignmentId_studentId: { assignmentId: a.id, studentId: ctx.user.id } },
        create: { cohortId: ctx.cohortId, assignmentId: a.id, studentId: ctx.user.id, ...fields },
        update: fields,
      });
    } catch (e) {
      if (stored) await deleteFile(stored.filePath);
      throw e;
    }
    if (stored && prev?.filePath) await deleteFile(prev.filePath);
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
          file: s?.filePath ? { submissionId: s.id, name: s.fileName ?? "제출 파일" } : null,
          submittedAt: s ? formatDateTime(s.submittedAt) : null,
        };
      }),
    };
  } catch (e) {
    if (e instanceof AccessDeniedError) return { ok: false as const, error: "권한이 없습니다." };
    throw e;
  }
}
