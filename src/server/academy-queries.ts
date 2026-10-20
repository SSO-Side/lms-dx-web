// 학원 관리 조회 함수: 반 목록, 담당자 후보, 반 계정 목록, 전체 반 요약 대상 반.
// 호출 측이 먼저 역할(학원 관리자·슈퍼어드민) 또는 requireCohortAccess로 권한을 확인한다.
import { ActiveStatus, EnrollmentStatus, Role, type User } from "@prisma/client";
import { db } from "@/lib/db";

/** 학원 관리 홈의 반 목록(재적 인원·담당 매니저 포함, 최신 반 먼저). academyId가 null이면(슈퍼어드민) 전체. */
export async function listAcademyCohorts(academyId: number | null) {
  return db.cohort.findMany({
    where: academyId ? { academyId } : {},
    include: {
      enrollments: { where: { status: EnrollmentStatus.ENROLLED }, select: { id: true } },
      staff: { where: { staffRole: "MANAGER" }, include: { user: { select: { name: true } } } },
    },
    orderBy: { id: "desc" },
  });
}

/** 반 개설 때 고를 수 있는 담당자 후보(같은 학원의 활성 매니저·강사) */
export async function listStaffOptions(academyId: number | null) {
  return db.user.findMany({
    where: {
      ...(academyId ? { academyId } : {}),
      role: { in: [Role.MANAGER, Role.INSTRUCTOR] },
      status: ActiveStatus.ACTIVE,
    },
    select: { id: true, name: true, loginId: true, role: true },
    orderBy: [{ role: "desc" }, { name: "asc" }],
  });
}

const memberSelect = { id: true, name: true, loginId: true, phone: true, role: true, status: true } as const;

/** 반 계정 관리용: 반 이름과 교직원·수강생 계정 목록(교직원 먼저, 이름순). 반이 없으면 null. */
export async function getCohortAccounts(cohortId: number) {
  const [cohort, staffList, enrollments] = await Promise.all([
    db.cohort.findUnique({ where: { id: cohortId }, select: { id: true, name: true } }),
    db.cohortStaff.findMany({ where: { cohortId }, include: { user: { select: memberSelect } }, orderBy: { user: { name: "asc" } } }),
    db.enrollment.findMany({ where: { cohortId }, include: { student: { select: memberSelect } }, orderBy: { student: { name: "asc" } } }),
  ]);
  if (!cohort) return null;
  return { cohort, members: [...staffList.map((s) => s.user), ...enrollments.map((e) => e.student)] };
}

const overviewSelect = { id: true, name: true, room: true, startDate: true, endDate: true, status: true } as const;

/** 전체 반 요약 대상: 학원 관리자·슈퍼어드민은 학원 전체 반, 강사·매니저는 배정된 반 */
export async function listOverviewCohorts(user: Pick<User, "id" | "role" | "academyId">) {
  if (user.role === Role.ACADEMY_ADMIN || user.role === Role.ADMIN) {
    return db.cohort.findMany({ where: user.academyId ? { academyId: user.academyId } : {}, orderBy: { id: "asc" }, select: overviewSelect });
  }
  const rows = await db.cohortStaff.findMany({ where: { userId: user.id }, select: { cohort: { select: overviewSelect } } });
  return rows.map((s) => s.cohort);
}

