import { Role, EnrollmentStatus, type User } from "@prisma/client";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { hasActionPermission, type Action } from "./permissions";
import { canAccessCohortPure } from "./checker";

export class AccessDeniedError extends Error {
  statusCode = 403;
  constructor(message = "접근할 수 없습니다.") {
    super(message);
    this.name = "AccessDeniedError";
  }
}

export interface CohortContext {
  user: User;
  cohortId: number;
  role: Role;
}

export async function requireCohortAccess(
  cohortId: number | string,
  action: Action
): Promise<CohortContext> {
  const numCohortId = typeof cohortId === "string" ? parseInt(cohortId, 10) : cohortId;
  if (!numCohortId || isNaN(numCohortId)) {
    throw new AccessDeniedError();
  }

  const user = await getSessionUser();
  if (!user || user.status !== "ACTIVE" || user.mustChangePassword) {
    throw new AccessDeniedError();
  }

  // 액션 기본 권한 판정
  if (!hasActionPermission(user.role, action)) {
    throw new AccessDeniedError();
  }

  // 반 정보 조회 (존재하지 않아도 동일한 403 에러 반환)
  const cohort = await db.cohort.findUnique({
    where: { id: numCohortId },
    select: { id: true, academyId: true },
  });

  if (!cohort) {
    throw new AccessDeniedError();
  }

  // 소속 정보 조회
  let enrolledCohortIds: number[] = [];
  let staffCohortIds: number[] = [];

  if (user.role === Role.STUDENT) {
    const enrollment = await db.enrollment.findUnique({
      where: {
        cohortId_studentId: {
          cohortId: numCohortId,
          studentId: user.id,
        },
      },
      select: { status: true },
    });
    if (enrollment?.status === EnrollmentStatus.ENROLLED) {
      enrolledCohortIds = [numCohortId];
    }
  } else if (user.role === Role.INSTRUCTOR || user.role === Role.MANAGER) {
    const staff = await db.cohortStaff.findUnique({
      where: {
        cohortId_userId: {
          cohortId: numCohortId,
          userId: user.id,
        },
      },
      select: { id: true },
    });
    if (staff) {
      staffCohortIds = [numCohortId];
    }
  }

  const canAccess = canAccessCohortPure(user, cohort, {
    enrolledCohortIds,
    staffCohortIds,
  });

  if (!canAccess) {
    throw new AccessDeniedError();
  }

  return {
    user,
    cohortId: numCohortId,
    role: user.role,
  };
}
