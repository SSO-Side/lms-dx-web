// 대시보드 조회 함수: 반 요약 숫자와 훈련 진행률.
import { db } from "@/lib/db";
import type { TicketType } from "@prisma/client";
import { getAttendanceBase, computePeriodAttendance, type AttendanceBase, type StudentAttendance } from "./attendance-queries";

// 대시보드 요약. 호출 측이 반 접근 권한을 먼저 확인한다.

export type CohortSummary = {
  danger: number;
  warn: number;
  pendingTickets: number;
  todayIsTraining: boolean;
  todayClosed: boolean;
  unclosedCount: number;
};

/** 반 요약(위험·경고 인원, 처리 대기 티켓, 오늘 마감 여부, 미마감 일수): 전체 반 요약·학원 홈 카드용. */
export async function getCohortSummary(cohortId: number, base?: AttendanceBase): Promise<CohortSummary> {
  const b = base ?? (await getAttendanceBase(cohortId));
  const [rows, pendingTickets] = await Promise.all([
    b.currentPeriod ? computePeriodAttendance(cohortId, b, b.currentPeriod) : Promise.resolve([]),
    db.ticket.count({ where: { cohortId, status: { in: ["PENDING", "IN_REVIEW"] } } }),
  ]);
  return toSummary(b, rows, pendingTickets);
}

function toSummary(b: AttendanceBase, rows: StudentAttendance[], pendingTickets: number): CohortSummary {
  return {
    danger: rows.filter((r) => r.result.grade === "DANGER").length,
    warn: rows.filter((r) => r.result.grade === "WARN").length,
    pendingTickets,
    todayIsTraining: b.days.some((d) => d.date === b.today && d.isTraining),
    todayClosed: b.closedDates.has(b.today),
    unclosedCount: b.unclosedDates.length,
  };
}

/** 훈련 진행률: 오늘까지 지난 훈련일 / 전체 훈련일 */
export function trainingProgress(base: AttendanceBase) {
  const training = base.days.filter((d) => d.isTraining);
  return { done: training.filter((d) => d.date <= base.today).length, total: training.length };
}


export type AcademyRiskStudent = {
  cohortId: number;
  cohortName: string;
  studentId: number;
  name: string;
  grade: "DANGER" | "WARN";
  remaining: number;
  allowedAbsences: number;
};

export type AcademyCohortSummary = { cohortId: number; summary: CohortSummary | null };

/**
 * 학원 전체 대시보드: 반별 요약(실패한 반은 null)과 반을 가로지르는 위험·주의 학생(잔여 허용일 적은 순).
 * 호출 측이 학원 전체 접근(슈퍼어드민·서브 관리자)을 먼저 확인하고, 그 학원의 반만 넘긴다.
 */
export async function getAcademyDashboard(cohorts: Array<{ id: number; name: string }>) {
  const risk: AcademyRiskStudent[] = [];
  const summaries: AcademyCohortSummary[] = await Promise.all(
    cohorts.map(async (c) => {
      try {
        const b = await getAttendanceBase(c.id);
        const [rows, pendingTickets] = await Promise.all([
          b.currentPeriod ? computePeriodAttendance(c.id, b, b.currentPeriod) : Promise.resolve([]),
          db.ticket.count({ where: { cohortId: c.id, status: { in: ["PENDING", "IN_REVIEW"] } } }),
        ]);
        for (const r of rows) {
          if (r.result.grade === "DANGER" || r.result.grade === "WARN") {
            risk.push({
              cohortId: c.id,
              cohortName: c.name,
              studentId: r.studentId,
              name: r.name,
              grade: r.result.grade,
              remaining: r.result.remaining,
              allowedAbsences: r.result.allowedAbsences,
            });
          }
        }
        return { cohortId: c.id, summary: toSummary(b, rows, pendingTickets) };
      } catch {
        return { cohortId: c.id, summary: null };
      }
    })
  );
  risk.sort((a, b) => a.remaining - b.remaining || (a.grade === b.grade ? 0 : a.grade === "DANGER" ? -1 : 1));
  return { summaries, risk };
}

export type AcademyPendingTicket = {
  id: number;
  cohortId: number;
  cohortName: string;
  type: TicketType;
  status: string;
  title: string;
  requesterName: string;
  createdAt: Date;
};

/** 학원 전체 처리 대기 티켓(대기·검토 중, 오래된 순). 호출 측이 학원 전체 접근을 확인하고 그 학원의 반 id만 넘긴다. */
export async function listAcademyPendingTickets(cohortIds: number[], take = 8): Promise<AcademyPendingTicket[]> {
  if (cohortIds.length === 0) return [];
  const rows = await db.ticket.findMany({
    where: { cohortId: { in: cohortIds }, status: { in: ["PENDING", "IN_REVIEW"] } },
    include: { requester: { select: { name: true } }, cohort: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
    take,
  });
  return rows.map((t) => ({
    id: t.id,
    cohortId: t.cohortId,
    cohortName: t.cohort.name,
    type: t.type,
    status: t.status,
    title: t.title,
    requesterName: t.requester.name,
    createdAt: t.createdAt,
  }));
}
