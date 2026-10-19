// 반 접근 검사: 반 종속 서버 액션·페이지의 첫 줄에서 호출한다. 통과하면 cohortId·역할·사용자 정보(ctx)를 돌려준다.
import { Role, EnrollmentStatus, type User } from "@prisma/client";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { hasActionPermission, type Action } from "./permissions";
import { canAccessCohortPure } from "./checker";

/** 권한 없음 오류. 서버 액션은 이것을 잡아 "권한이 없습니다"로 바꾼다. */
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

/** 반 접근과 동작 권한을 함께 검사한다. 실패하면 AccessDeniedError, 통과하면 ctx(cohortId·role·user). */
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
