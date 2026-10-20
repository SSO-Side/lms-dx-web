// 화면 뼈대용 조회 함수: 반 화면 레이아웃(반 접근·반 전환 목록), 로그인 직후 진입 반, 학원 이름.
import { EnrollmentStatus, Role, type User } from "@prisma/client";
import { db } from "@/lib/db";
import { canAccessCohortPure } from "@/lib/access/checker";

type CohortOption = { id: number; name: string };

/**
 * 반 화면 레이아웃용: 이 사용자가 이 반에 들어올 수 있으면 반 정보와 반 전환 목록, 아니면 null.
 * (반이 없을 때도 null — 존재 여부를 알리지 않는다)
 */
export async function getCohortShell(
  user: User,
  cohortId: number
): Promise<{ cohort: { id: number; name: string; room: string | null }; cohorts: CohortOption[] } | null> {
  const cohort = await db.cohort.findUnique({ where: { id: cohortId }, select: { id: true, name: true, academyId: true, room: true } });
  if (!cohort) return null;

  let cohorts: CohortOption[] = [];
  let allowed = false;
  if (user.role === Role.ADMIN) {
    allowed = true;
    cohorts = await db.cohort.findMany({ select: { id: true, name: true }, orderBy: { id: "asc" } });
  } else if (user.role === Role.ACADEMY_ADMIN) {
    allowed = user.academyId === cohort.academyId;
    if (user.academyId) {
      cohorts = await db.cohort.findMany({ where: { academyId: user.academyId }, select: { id: true, name: true }, orderBy: { id: "asc" } });
    }
  } else if (user.role === Role.STUDENT) {
    const enrollments = await db.enrollment.findMany({
      where: { studentId: user.id, status: EnrollmentStatus.ENROLLED },
      include: { cohort: { select: { id: true, name: true } } },
    });
    cohorts = enrollments.map((e) => e.cohort);
    allowed = canAccessCohortPure(user, cohort, { enrolledCohortIds: enrollments.map((e) => e.cohortId), staffCohortIds: [] });
  } else {
    // INSTRUCTOR, MANAGER
    const staffList = await db.cohortStaff.findMany({ where: { userId: user.id }, include: { cohort: { select: { id: true, name: true } } } });
    cohorts = staffList.map((s) => s.cohort);
    allowed = canAccessCohortPure(user, cohort, { enrolledCohortIds: [], staffCohortIds: staffList.map((s) => s.cohortId) });
  }
  if (!allowed) return null;
  return { cohort: { id: cohort.id, name: cohort.name, room: cohort.room }, cohorts };
}

/** 수강생이 재적 중인 첫 반 id (없으면 null) */
export async function getEnrolledCohortId(studentId: number): Promise<number | null> {
  const e = await db.enrollment.findFirst({ where: { studentId, status: EnrollmentStatus.ENROLLED }, select: { cohortId: true } });
  return e?.cohortId ?? null;
}

/** 강사·매니저가 배정된 반 id 목록 */
export async function listStaffCohortIds(userId: number): Promise<number[]> {
  const rows = await db.cohortStaff.findMany({ where: { userId }, select: { cohortId: true } });
  return rows.map((r) => r.cohortId);
}

/** 학원 이름 (학원 관리 화면 제목용) */
export async function getAcademyName(academyId: number | null): Promise<string | null> {
  if (!academyId) return null;
  const a = await db.academy.findUnique({ where: { id: academyId }, select: { name: true } });
  return a?.name ?? null;
}
