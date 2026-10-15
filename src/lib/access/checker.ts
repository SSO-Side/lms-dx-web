import { Role, type ActiveStatus } from "@prisma/client";

export interface UserAccessInfo {
  id: number;
  role: Role;
  status: ActiveStatus | string;
  mustChangePassword?: boolean;
  academyId: number | null;
}

export interface CohortAccessInfo {
  id: number;
  academyId: number;
}

export interface UserCohortMembership {
  enrolledCohortIds: number[];
  staffCohortIds: number[];
}

export function canAccessCohortPure(
  user: UserAccessInfo,
  cohort: CohortAccessInfo | null,
  membership: UserCohortMembership = { enrolledCohortIds: [], staffCohortIds: [] }
): boolean {
  if (!cohort) {
    return false;
  }

  if (user.status !== "ACTIVE") {
    return false;
  }

  if (user.mustChangePassword) {
    return false;
  }

  if (user.role === Role.ADMIN) {
    return true;
  }

  if (user.role === Role.ACADEMY_ADMIN) {
    return user.academyId !== null && user.academyId === cohort.academyId;
  }

  if (user.role === Role.STUDENT) {
    return membership.enrolledCohortIds.includes(cohort.id);
  }

  if (user.role === Role.INSTRUCTOR || user.role === Role.MANAGER) {
    return membership.staffCohortIds.includes(cohort.id);
  }

  return false;
}

export interface ManagedAccountInfo {
  role: Role;
  academyId: number | null;
  /** 이 반의 Enrollment가 ENROLLED 상태인지 */
  enrolledInCohort: boolean;
  /** 이 반의 CohortStaff로 배정되어 있는지 */
  staffInCohort: boolean;
}

/**
 * 반 단위 계정 관리(비밀번호 재설정·비활성화)의 대상이 될 수 있는지 판정한다.
 * 대상은 같은 학원 소속이면서 이 반의 재적 수강생이나 배정 교직원이어야 하고,
 * 학원 관리자·시스템 관리자 계정은 반 단위 관리 대상이 아니다.
 */
export function canManageCohortAccountPure(target: ManagedAccountInfo, cohort: CohortAccessInfo): boolean {
  if (target.role === Role.ACADEMY_ADMIN || target.role === Role.ADMIN) {
    return false;
  }
  if (target.academyId === null || target.academyId !== cohort.academyId) {
    return false;
  }
  if (target.role === Role.STUDENT) {
    return target.enrolledInCohort;
  }
  return target.staffInCohort;
}
