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
