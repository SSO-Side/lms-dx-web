// 반 정보 조회 함수: 반 홈 머리글, 반 설정, 명부, 재적 상태별 인원.
// 호출 측이 먼저 requireCohortAccess(tryCohortAccess)로 권한을 확인하고 ctx.cohortId만 넘긴다.
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/** 티켓을 맡길 주담당 매니저 id. 비활성 계정은 제외하며, 없으면 null(학원 관리자가 처리). */
export async function findActivePrimaryManagerId(cohortId: number, client: Prisma.TransactionClient = db): Promise<number | null> {
  const staff = await client.cohortStaff.findFirst({
    where: { cohortId, staffRole: "MANAGER", isPrimary: true, user: { status: "ACTIVE" } },
    select: { userId: true },
  });
  return staff?.userId ?? null;
}

/** 반 홈 머리글용 반 정보(과정명·훈련 유형·강의실·기간·상태) */
export async function getCohortInfo(cohortId: number) {
  return db.cohort.findUnique({
    where: { id: cohortId },
    select: { name: true, trainingType: true, room: true, startDate: true, endDate: true, status: true },
  });
}

/** 반 설정 화면용 반 정보(기본 정보·주간 시간표·휴일) */
export async function getCohortSettings(cohortId: number) {
  return db.cohort.findUnique({
    where: { id: cohortId },
    select: { name: true, trainingType: true, room: true, status: true, startDate: true, endDate: true, weeklySchedule: true, holidays: true },
  });
}

/** 반이 속한 학원 id (없으면 null) */
export async function getCohortAcademyId(cohortId: number): Promise<number | null> {
  const c = await db.cohort.findUnique({ where: { id: cohortId }, select: { academyId: true } });
  return c?.academyId ?? null;
}

/** 명부: 수강생(이름순)과 교직원(역할순) */
export async function listCohortMembers(cohortId: number) {
  const [enrollments, staff] = await Promise.all([
    db.enrollment.findMany({
      where: { cohortId },
      include: { student: { select: { id: true, name: true, loginId: true, phone: true, status: true, lastLoginAt: true } } },
      orderBy: { student: { name: "asc" } },
    }),
    db.cohortStaff.findMany({
      where: { cohortId },
      include: { user: { select: { id: true, name: true, loginId: true, phone: true, status: true, lastLoginAt: true, role: true } } },
      orderBy: { staffRole: "asc" },
    }),
  ]);
  return { enrollments, staff };
}

/** 재적 상태별 수강생 수 (반 홈 위젯용) */
export async function countEnrollmentsByStatus(cohortId: number) {
  return db.enrollment.groupBy({ by: ["status"], where: { cohortId }, _count: { _all: true } });
}
