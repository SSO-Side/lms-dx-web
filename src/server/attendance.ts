"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { EnrollmentStatus, LogAction, type AttendanceEvent, type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireCohortAccess, AccessDeniedError } from "@/lib/access/requireCohortAccess";
import { isYmd, ymdToDate, dateToYmd } from "@/lib/dates";
import { getStudentEvents } from "./attendance-queries";
import { tryCohortAccess } from "@/lib/access/pageAccess";

type Result = { ok: true } | { ok: false; error: string };

const EV_TYPES = ["ABSENT", "LATE", "EARLY_LEAVE", "OUT"] as const;
const ymd = z.string().refine(isYmd, "날짜 형식이 올바르지 않습니다.");
const excusedTypeSchema = z.enum(["SICK", "LEAVE"]).nullable();

function snapshot(e: AttendanceEvent): Prisma.InputJsonValue {
  return {
    studentId: e.studentId,
    date: dateToYmd(e.date),
    type: e.type,
    excused: e.excused,
    excusedType: e.excusedType,
    ticketId: e.ticketId,
    note: e.note,
  };
}

function refresh(cohortId: number) {
  revalidatePath(`/app/c/${cohortId}/attendance`);
  revalidatePath(`/app/c/${cohortId}`);
}

async function wrap(fn: () => Promise<Result>): Promise<Result> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AccessDeniedError) return { ok: false, error: "권한이 없습니다." };
    throw e;
  }
}

/** 훈련일 여부와 재적 여부를 반 범위 안에서 확인한다. */
async function assertDayAndStudent(cohortId: number, date: string, studentId: number): Promise<string | null> {
  const [day, enrollment] = await Promise.all([
    db.trainingDay.findUnique({ where: { cohortId_date: { cohortId, date: ymdToDate(date) } } }),
    db.enrollment.findUnique({ where: { cohortId_studentId: { cohortId, studentId } } }),
  ]);
  if (!day || !day.isTraining) return "훈련일이 아닌 날짜에는 출결을 기록할 수 없습니다.";
  if (!enrollment || enrollment.status !== EnrollmentStatus.ENROLLED) return "이 반의 재적 수강생이 아닙니다.";
  return null;
}

const dayStatusSchema = z.object({
  date: ymd,
  studentId: z.number().int(),
  types: z.array(z.enum(EV_TYPES)).max(4),
  excusedType: excusedTypeSchema,
  note: z.string().trim().max(300).nullable(),
});

/** 오늘 출결: 학생 한 명의 그날 상태를 통째로 맞춘다. types가 비면 출석. */
export async function setDayStatusAction(cohortId: number, input: z.input<typeof dayStatusSchema>): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "attendance:write");
    const parsed = dayStatusSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "입력값 오류" };
    const { date, studentId, excusedType, note } = parsed.data;
    const types = [...new Set(parsed.data.types)];
    if (types.includes("ABSENT") && types.length > 1) return { ok: false, error: "결석은 다른 상태와 함께 기록할 수 없습니다." };

    const invalid = await assertDayAndStudent(ctx.cohortId, date, studentId);
    if (invalid) return { ok: false, error: invalid };

    const d = ymdToDate(date);
    const approvedTicket = await db.ticket.findFirst({
      where: { cohortId: ctx.cohortId, requesterId: studentId, type: "ABSENCE", status: "APPROVED", absence: { absentDate: d } },
      select: { id: true },
    });

    await db.$transaction(async (tx) => {
      const existing = await tx.attendanceEvent.findMany({ where: { cohortId: ctx.cohortId, studentId, date: d } });
      for (const e of existing) {
        if (!types.includes(e.type)) {
          await tx.attendanceEvent.delete({ where: { id: e.id } });
          await tx.attendanceEventLog.create({
            data: { cohortId: ctx.cohortId, eventId: e.id, action: LogAction.DELETE, actorId: ctx.user.id, before: snapshot(e) },
          });
        }
      }
      for (const type of types) {
        const isAbsent = type === "ABSENT";
        const data = {
          excused: isAbsent && !!excusedType,
          excusedType: isAbsent ? excusedType : null,
          ticketId: isAbsent && excusedType ? approvedTicket?.id ?? null : null,
          note: note || null,
        };
        const prev = existing.find((e) => e.type === type);
        if (prev) {
          const changed =
            prev.excused !== data.excused || prev.excusedType !== data.excusedType || prev.note !== data.note || prev.ticketId !== data.ticketId;
          if (!changed) continue;
          const updated = await tx.attendanceEvent.update({ where: { id: prev.id }, data: { ...data, recordedById: ctx.user.id } });
          await tx.attendanceEventLog.create({
            data: { cohortId: ctx.cohortId, eventId: prev.id, action: LogAction.UPDATE, actorId: ctx.user.id, before: snapshot(prev), after: snapshot(updated) },
          });
        } else {
          const created = await tx.attendanceEvent.create({
            data: { cohortId: ctx.cohortId, studentId, date: d, type, recordedById: ctx.user.id, ...data },
          });
          await tx.attendanceEventLog.create({
            data: { cohortId: ctx.cohortId, eventId: created.id, action: LogAction.CREATE, actorId: ctx.user.id, after: snapshot(created) },
          });
        }
      }
    });

    refresh(ctx.cohortId);
    return { ok: true };
  });
}

/** [오늘 출결 확인 완료] — 최종 반영일 갱신. */
export async function closeDayAction(cohortId: number, date: string): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "attendance:write");
    if (!isYmd(date)) return { ok: false, error: "날짜 형식이 올바르지 않습니다." };
    const d = ymdToDate(date);
    const day = await db.trainingDay.findUnique({ where: { cohortId_date: { cohortId: ctx.cohortId, date: d } } });
    if (!day || !day.isTraining) return { ok: false, error: "훈련일이 아닙니다." };

    await db.attendanceDayClose.upsert({
      where: { cohortId_date: { cohortId: ctx.cohortId, date: d } },
      create: { cohortId: ctx.cohortId, date: d, closedById: ctx.user.id },
      update: { closedById: ctx.user.id, closedAt: new Date() },
    });
    refresh(ctx.cohortId);
    return { ok: true };
  });
}

const eventSchema = z.object({
  eventId: z.number().int().optional(),
  studentId: z.number().int(),
  date: ymd,
  type: z.enum(EV_TYPES),
  excusedType: excusedTypeSchema,
  note: z.string().trim().max(300).nullable(),
});

/** 명부 카운터 드로어: 일자 기록 추가·수정. 같은 (학생, 날짜, 유형)이 있으면 수정으로 처리한다. */
export async function upsertEventAction(cohortId: number, input: z.input<typeof eventSchema>): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "attendance:write");
    const parsed = eventSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "입력값 오류" };
    const { eventId, studentId, date, type, excusedType, note } = parsed.data;

    const invalid = await assertDayAndStudent(ctx.cohortId, date, studentId);
    if (invalid) return { ok: false, error: invalid };

    const d = ymdToDate(date);
    const isAbsent = type === "ABSENT";
    const data = {
      studentId,
      date: d,
      type,
      excused: isAbsent && !!excusedType,
      excusedType: isAbsent ? excusedType : null,
      note: note || null,
      recordedById: ctx.user.id,
    };

    return db.$transaction(async (tx): Promise<Result> => {
      const target = eventId
        ? await tx.attendanceEvent.findFirst({ where: { id: eventId, cohortId: ctx.cohortId } })
        : await tx.attendanceEvent.findUnique({
            where: { cohortId_studentId_date_type: { cohortId: ctx.cohortId, studentId, date: d, type } },
          });
      if (eventId && !target) return { ok: false, error: "기록을 찾을 수 없습니다." };

      if (target) {
        if (target.studentId !== studentId) return { ok: false, error: "다른 학생의 기록입니다." };
        const clash =
          (target.type !== type || dateToYmd(target.date) !== date) &&
          (await tx.attendanceEvent.findUnique({
            where: { cohortId_studentId_date_type: { cohortId: ctx.cohortId, studentId, date: d, type } },
          }));
        if (clash) return { ok: false, error: "같은 날짜에 같은 유형의 기록이 이미 있습니다." };
        const updated = await tx.attendanceEvent.update({ where: { id: target.id }, data });
        await tx.attendanceEventLog.create({
          data: { cohortId: ctx.cohortId, eventId: target.id, action: LogAction.UPDATE, actorId: ctx.user.id, before: snapshot(target), after: snapshot(updated) },
        });
      } else {
        const created = await tx.attendanceEvent.create({ data: { cohortId: ctx.cohortId, ...data } });
        await tx.attendanceEventLog.create({
          data: { cohortId: ctx.cohortId, eventId: created.id, action: LogAction.CREATE, actorId: ctx.user.id, after: snapshot(created) },
        });
      }
      refresh(ctx.cohortId);
      return { ok: true };
    });
  });
}

export async function deleteEventAction(cohortId: number, eventId: number): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "attendance:write");
    const target = await db.attendanceEvent.findFirst({ where: { id: eventId, cohortId: ctx.cohortId } });
    if (!target) return { ok: false, error: "기록을 찾을 수 없습니다." };
    await db.$transaction([
      db.attendanceEvent.delete({ where: { id: target.id } }),
      db.attendanceEventLog.create({
        data: { cohortId: ctx.cohortId, eventId: target.id, action: LogAction.DELETE, actorId: ctx.user.id, before: snapshot(target) },
      }),
    ]);
    refresh(ctx.cohortId);
    return { ok: true };
  });
}

const count = z.number().int().min(0).max(999);
const openingSchema = z.object({
  periodId: z.number().int(),
  asOfDate: ymd,
  rows: z
    .array(
      z.object({ studentId: z.number().int(), absent: count, late: count, earlyLeave: count, out: count, excusedUsed: count })
    )
    .min(1),
});

/** 초기 이관값 입력. 반당 1회만 허용한다. */
export async function saveOpeningsAction(cohortId: number, input: z.input<typeof openingSchema>): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "attendance:write");
    const parsed = openingSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "입력값 오류" };
    const { periodId, asOfDate, rows } = parsed.data;

    const [period, already, enrolled] = await Promise.all([
      db.attendancePeriod.findFirst({ where: { id: periodId, cohortId: ctx.cohortId } }),
      db.attendanceOpening.count({ where: { cohortId: ctx.cohortId } }),
      db.enrollment.findMany({ where: { cohortId: ctx.cohortId, status: EnrollmentStatus.ENROLLED }, select: { studentId: true } }),
    ]);
    if (!period) return { ok: false, error: "단위기간을 찾을 수 없습니다." };
    if (already > 0) return { ok: false, error: "초기 이관은 반당 한 번만 입력할 수 있습니다." };
    const s = dateToYmd(period.startDate);
    const e = dateToYmd(period.endDate);
    if (asOfDate < s || asOfDate > e) return { ok: false, error: "기준일은 선택한 단위기간 안이어야 합니다." };
    const enrolledIds = new Set(enrolled.map((x) => x.studentId));
    if (rows.some((r) => !enrolledIds.has(r.studentId))) return { ok: false, error: "재적 수강생이 아닌 행이 있습니다." };

    await db.attendanceOpening.createMany({
      data: rows.map((r) => ({ cohortId: ctx.cohortId, periodId, asOfDate: ymdToDate(asOfDate), recordedById: ctx.user.id, ...r })),
    });
    refresh(ctx.cohortId);
    return { ok: true };
  });
}

/** 드로어용 학생 일자별 기록. 반 열람 권한 또는 본인. */
export async function getStudentEventsAction(cohortId: number, studentId: number, periodId: number | null) {
  const ctx = await tryCohortAccess(cohortId, "attendance:readCohort");
  if (!ctx) return { ok: false as const, error: "권한이 없습니다." };
  const period = periodId ? await db.attendancePeriod.findFirst({ where: { id: periodId, cohortId: ctx.cohortId } }) : null;
  const events = await getStudentEvents(
    ctx.cohortId,
    studentId,
    period ? { startDate: dateToYmd(period.startDate), endDate: dateToYmd(period.endDate) } : undefined
  );
  return { ok: true as const, events };
}
