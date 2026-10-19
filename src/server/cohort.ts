"use server";

// 반 관리 서버 액션: 반 정보·출결 규칙·휴일 수정, 수강생 재적 상태 변경.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { EnrollmentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireCohortAccess, AccessDeniedError } from "@/lib/access/requireCohortAccess";
import { isYmd, ymdToDate, dateToYmd, dowOfYmd } from "@/lib/dates";
import { withDefaults } from "@/lib/attendance/compute";

type Result = { ok: true } | { ok: false; error: string };

async function wrap(fn: () => Promise<Result>): Promise<Result> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AccessDeniedError) return { ok: false, error: "권한이 없습니다." };
    throw e;
  }
}
const firstError = (e: z.ZodError) => e.issues[0]?.message ?? "입력값을 확인해 주세요.";

/** 명부: 수강생 재적 상태 변경 (MANAGER·ACADEMY_ADMIN — attendance:write 역할 범위와 같다) */
export async function updateEnrollmentStatusAction(cohortId: number, studentId: number, status: EnrollmentStatus): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "attendance:write");
    if (!Object.values(EnrollmentStatus).includes(status)) return { ok: false, error: "잘못된 상태입니다." };
    const res = await db.enrollment.updateMany({ where: { cohortId: ctx.cohortId, studentId }, data: { status } });
    if (res.count === 0) return { ok: false, error: "이 반의 수강생이 아닙니다." };
    revalidatePath(`/app/c/${ctx.cohortId}`, "layout");
    return { ok: true };
  });
}

const infoSchema = z.object({
  name: z.string().trim().min(1, "과정명은 필수입니다.").max(200),
  trainingType: z.string().trim().max(100),
  room: z.string().trim().max(100),
  status: z.enum(["ACTIVE", "ENDED"]),
});

/** 반 설정: 기본 정보 (ACADEMY_ADMIN만) */
export async function updateCohortInfoAction(cohortId: number, input: z.input<typeof infoSchema>): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "account:manage");
    const parsed = infoSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    await db.cohort.update({
      where: { id: ctx.cohortId },
      data: { name: parsed.data.name, trainingType: parsed.data.trainingType || null, room: parsed.data.room || null, status: parsed.data.status },
    });
    revalidatePath(`/app/c/${ctx.cohortId}`, "layout");
    return { ok: true };
  });
}

const configSchema = z.object({
  requiredPercent: z.number().int().min(1).max(100),
  lateEarlyToAbsent: z.number().int().min(1).max(10),
  combineLateEarly: z.boolean(),
  excusedLimit: z.number().int().min(0).max(100).nullable(),
  normalMinRemaining: z.number().int().min(0).max(30),
  warnMinRemaining: z.number().int().min(0).max(30),
});

/** 반 설정: 출결 규칙 (attendanceConfig). ACADEMY_ADMIN만. */
export async function updateAttendanceConfigAction(cohortId: number, input: z.input<typeof configSchema>): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "account:manage");
    const parsed = configSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const v = parsed.data;
    if (v.warnMinRemaining > v.normalMinRemaining) return { ok: false, error: "주의 기준은 정상 기준보다 클 수 없습니다." };
    const cohort = await db.cohort.findUnique({ where: { id: ctx.cohortId }, select: { attendanceConfig: true } });
    const prev = withDefaults(cohort?.attendanceConfig as Parameters<typeof withDefaults>[0]);
    const next = {
      ...prev,
      requiredPercent: v.requiredPercent,
      lateEarlyToAbsent: v.lateEarlyToAbsent,
      combineLateEarly: v.combineLateEarly,
      excused: { ...prev.excused, limit: v.excusedLimit },
      grade: { normalMinRemaining: v.normalMinRemaining, warnMinRemaining: v.warnMinRemaining },
    };
    await db.cohort.update({ where: { id: ctx.cohortId }, data: { attendanceConfig: next } });
    revalidatePath(`/app/c/${ctx.cohortId}`, "layout");
    return { ok: true };
  });
}

/** 반 설정: 휴강일 지정·해제. 훈련일(TrainingDay)의 isTraining을 함께 바꾼다. */
export async function setHolidayAction(cohortId: number, date: string, holiday: boolean): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "account:manage");
    if (!isYmd(date)) return { ok: false, error: "날짜 형식이 올바르지 않습니다." };
    const cohort = await db.cohort.findUnique({
      where: { id: ctx.cohortId },
      select: { startDate: true, endDate: true, holidays: true, weeklySchedule: true },
    });
    if (!cohort) return { ok: false, error: "반을 찾을 수 없습니다." };
    if (date < dateToYmd(cohort.startDate) || date > dateToYmd(cohort.endDate)) return { ok: false, error: "훈련 기간 밖의 날짜입니다." };
    const schedule = (cohort.weeklySchedule ?? {}) as Record<string, unknown>;
    if (!schedule[String(dowOfYmd(date))]) return { ok: false, error: "수업 요일이 아닙니다." };

    const d = ymdToDate(date);
    if (holiday) {
      const [events, closed] = await Promise.all([
        db.attendanceEvent.count({ where: { cohortId: ctx.cohortId, date: d } }),
        db.attendanceDayClose.count({ where: { cohortId: ctx.cohortId, date: d } }),
      ]);
      if (events > 0 || closed > 0) return { ok: false, error: "이미 출결이 기록된 날은 휴강으로 바꿀 수 없습니다." };
    }

    const list = new Set(Array.isArray(cohort.holidays) ? (cohort.holidays as string[]) : []);
    if (holiday) list.add(date);
    else list.delete(date);

    await db.$transaction([
      db.trainingDay.upsert({
        where: { cohortId_date: { cohortId: ctx.cohortId, date: d } },
        create: { cohortId: ctx.cohortId, date: d, isTraining: !holiday, note: holiday ? "휴강" : null },
        update: { isTraining: !holiday, note: holiday ? "휴강" : null },
      }),
      db.cohort.update({ where: { id: ctx.cohortId }, data: { holidays: [...list].sort() } }),
    ]);
    revalidatePath(`/app/c/${ctx.cohortId}`, "layout");
    return { ok: true };
  });
}
