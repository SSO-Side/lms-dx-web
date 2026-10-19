// 출결 조회 함수: 훈련일·단위기간·이벤트를 읽어 누계를 계산한다(저장하지 않음).
import { EnrollmentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { dateToYmd, todayYmd, ymdToDate } from "@/lib/dates";
import {
  computeAttendance,
  countTrainingDays,
  withDefaults,
  type AttendanceConfig,
  type AttendanceResult,
  type Ev,
  type Opening,
} from "@/lib/attendance/compute";
import { findPeriod } from "@/lib/attendance/schedule";

// 출결 화면용 조회. 호출 측(페이지·위젯)이 먼저 requireCohortAccess로 권한을 확인하고 ctx.cohortId만 넘긴다.

export type PeriodInfo = { id: number; label: string; startDate: string; endDate: string; trainingDays: number };

export type AttendanceBase = {
  config: AttendanceConfig;
  days: { date: string; isTraining: boolean; note: string | null }[];
  periods: PeriodInfo[];
  currentPeriod: PeriodInfo | null;
  closedDates: Set<string>;
  lastClosedDate: string | null;
  /** 현재 단위기간에서 오늘 이전 훈련일 중 확인되지 않은 날 */
  unclosedDates: string[];
  today: string;
};

/** 출결 계산 공통 데이터: 반 출결 규칙, 훈련일, 단위기간, 마감한 날짜. */
export async function getAttendanceBase(cohortId: number): Promise<AttendanceBase> {
  const [cohort, dayRows, periodRows, closeRows] = await Promise.all([
    db.cohort.findUnique({ where: { id: cohortId }, select: { attendanceConfig: true } }),
    db.trainingDay.findMany({ where: { cohortId }, orderBy: { date: "asc" } }),
    db.attendancePeriod.findMany({ where: { cohortId }, orderBy: { startDate: "asc" } }),
    db.attendanceDayClose.findMany({ where: { cohortId }, select: { date: true }, orderBy: { date: "asc" } }),
  ]);

  const config = withDefaults(cohort?.attendanceConfig as Parameters<typeof withDefaults>[0]);
  const days = dayRows.map((d) => ({ date: dateToYmd(d.date), isTraining: d.isTraining, note: d.note }));
  const periods: PeriodInfo[] = periodRows.map((p) => {
    const startDate = dateToYmd(p.startDate);
    const endDate = dateToYmd(p.endDate);
    return { id: p.id, label: p.label, startDate, endDate, trainingDays: countTrainingDays(days, startDate, endDate) };
  });
  const today = todayYmd();
  const currentPeriod =
    findPeriod(periods, today) ??
    (periods.length ? (today < periods[0].startDate ? periods[0] : periods[periods.length - 1]) : null);

  const closedDates = new Set(closeRows.map((c) => dateToYmd(c.date)));
  const lastClosedDate = closeRows.length ? dateToYmd(closeRows[closeRows.length - 1].date) : null;
  const unclosedDates = currentPeriod
    ? days
        .filter((d) => d.isTraining && d.date >= currentPeriod.startDate && d.date <= currentPeriod.endDate && d.date < today)
        .filter((d) => !closedDates.has(d.date))
        .map((d) => d.date)
    : [];

  return { config, days, periods, currentPeriod, closedDates, lastClosedDate, unclosedDates, today };
}

export type StudentAttendance = {
  studentId: number;
  name: string;
  loginId: string;
  result: AttendanceResult;
  hasOpening: boolean;
};

/** 단위기간 하나에 대해 학생별 출결 계산. studentId를 주면 그 학생만. */
export async function computePeriodAttendance(
  cohortId: number,
  base: AttendanceBase,
  period: PeriodInfo,
  studentId?: number
): Promise<StudentAttendance[]> {
  const enrollments = await db.enrollment.findMany({
    where: { cohortId, status: EnrollmentStatus.ENROLLED, ...(studentId ? { studentId } : {}) },
    include: { student: { select: { id: true, name: true, loginId: true } } },
    orderBy: { student: { name: "asc" } },
  });
  const ids = enrollments.map((e) => e.studentId);
  if (!ids.length) return [];

  const [events, openings] = await Promise.all([
    db.attendanceEvent.findMany({
      where: {
        cohortId,
        studentId: { in: ids },
        date: { gte: ymdToDate(period.startDate), lte: ymdToDate(period.endDate) },
      },
      select: { studentId: true, date: true, type: true, excused: true },
    }),
    db.attendanceOpening.findMany({ where: { cohortId, periodId: period.id, studentId: { in: ids } } }),
  ]);

  const evByStudent = new Map<number, Ev[]>();
  for (const e of events) {
    const list = evByStudent.get(e.studentId) ?? [];
    list.push({ date: dateToYmd(e.date), type: e.type, excused: e.excused });
    evByStudent.set(e.studentId, list);
  }
  const openingByStudent = new Map<number, Opening>(
    openings.map((o) => [
      o.studentId,
      { absent: o.absent, late: o.late, earlyLeave: o.earlyLeave, out: o.out, excusedUsed: o.excusedUsed, asOfDate: dateToYmd(o.asOfDate) },
    ])
  );

  return enrollments.map((e) => ({
    studentId: e.studentId,
    name: e.student.name,
    loginId: e.student.loginId,
    hasOpening: openingByStudent.has(e.studentId),
    result: computeAttendance({
      trainingDays: period.trainingDays,
      events: evByStudent.get(e.studentId) ?? [],
      opening: openingByStudent.get(e.studentId),
      config: base.config,
    }),
  }));
}

export type DayEntry = {
  studentId: number;
  name: string;
  loginId: string;
  events: { id: number; type: Ev["type"]; excused: boolean; excusedType: "SICK" | "LEAVE" | null; ticketId: number | null; note: string | null }[];
  /** 해당 일자에 승인된 병결·휴가 신청 */
  approvedTicket: { id: number; reasonType: "SICK" | "LEAVE" | "OTHER" } | null;
};

/** 오늘 출결 화면: 날짜 하나에 대한 명부와 예외 이벤트. */
export async function getDaySheet(cohortId: number, date: string): Promise<DayEntry[]> {
  const d = ymdToDate(date);
  const [enrollments, events, tickets] = await Promise.all([
    db.enrollment.findMany({
      where: { cohortId, status: EnrollmentStatus.ENROLLED },
      include: { student: { select: { id: true, name: true, loginId: true } } },
      orderBy: { student: { name: "asc" } },
    }),
    db.attendanceEvent.findMany({ where: { cohortId, date: d } }),
    db.ticket.findMany({
      where: { cohortId, type: "ABSENCE", status: "APPROVED", absence: { absentDate: d } },
      select: { id: true, requesterId: true, absence: { select: { reasonType: true } } },
    }),
  ]);

  return enrollments.map((e) => ({
    studentId: e.studentId,
    name: e.student.name,
    loginId: e.student.loginId,
    events: events
      .filter((ev) => ev.studentId === e.studentId)
      .map((ev) => ({ id: ev.id, type: ev.type, excused: ev.excused, excusedType: ev.excusedType, ticketId: ev.ticketId, note: ev.note })),
    approvedTicket: (() => {
      const t = tickets.find((x) => x.requesterId === e.studentId);
      return t && t.absence ? { id: t.id, reasonType: t.absence.reasonType } : null;
    })(),
  }));
}

export type StudentEventRow = {
  id: number;
  date: string;
  type: Ev["type"];
  excused: boolean;
  excusedType: "SICK" | "LEAVE" | null;
  ticketId: number | null;
  hasProof: boolean;
  note: string | null;
};

/** 학생 한 명의 일자별 기록 (기간 지정 시 그 기간만). */
export async function getStudentEvents(
  cohortId: number,
  studentId: number,
  range?: { startDate: string; endDate: string }
): Promise<StudentEventRow[]> {
  const events = await db.attendanceEvent.findMany({
    where: {
      cohortId,
      studentId,
      ...(range ? { date: { gte: ymdToDate(range.startDate), lte: ymdToDate(range.endDate) } } : {}),
    },
    orderBy: { date: "desc" },
  });
  const ticketIds = events.map((e) => e.ticketId).filter((x): x is number => x !== null);
  const withProof = ticketIds.length
    ? await db.ticketAttachment.findMany({ where: { ticketId: { in: ticketIds } }, select: { ticketId: true }, distinct: ["ticketId"] })
    : [];
  const proofSet = new Set(withProof.map((a) => a.ticketId));

  return events.map((e) => ({
    id: e.id,
    date: dateToYmd(e.date),
    type: e.type,
    excused: e.excused,
    excusedType: e.excusedType,
    ticketId: e.ticketId,
    hasProof: e.ticketId !== null && proofSet.has(e.ticketId),
    note: e.note,
  }));
}
