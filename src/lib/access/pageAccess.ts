import { requireCohortAccess, AccessDeniedError, type CohortContext } from "./requireCohortAccess";
import type { Action } from "./permissions";

/** 페이지용: 권한이 없으면 예외 대신 null (AccessDenied 화면을 그리기 위해). */
export async function tryCohortAccess(cohortId: number | string, action: Action): Promise<CohortContext | null> {
  try {
    return await requireCohortAccess(cohortId, action);
  } catch (e) {
    if (e instanceof AccessDeniedError) return null;
    throw e;
  }
}
