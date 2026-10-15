import { db } from "@/lib/db";
import { getAttendanceBase, computePeriodAttendance, type AttendanceBase } from "./attendance-queries";

// 대시보드 요약. 호출 측이 반 접근 권한을 먼저 확인한다.

export type CohortSummary = {
  danger: number;
  warn: number;
  pendingTickets: number;
  todayIsTraining: boolean;
  todayClosed: boolean;
  unclosedCount: number;
};

export async function getCohortSummary(cohortId: number, base?: AttendanceBase): Promise<CohortSummary> {
  const b = base ?? (await getAttendanceBase(cohortId));
  const [rows, pendingTickets] = await Promise.all([
    b.currentPeriod ? computePeriodAttendance(cohortId, b, b.currentPeriod) : Promise.resolve([]),
    db.ticket.count({ where: { cohortId, status: { in: ["PENDING", "IN_REVIEW"] } } }),
  ]);
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

