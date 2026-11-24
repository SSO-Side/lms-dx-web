// 챗봇 문서 대상(audience) 판정 (순수 함수). STUDENT 문서는 수강생만, INSTRUCTOR 문서는 교직원만, ALL은 모두.
import type { ChatAudience, Role } from "@prisma/client";

/** 이 역할이 볼 수 있는 문서 대상 목록 (DB where의 audience in 조건에 쓴다) */
export function visibleAudiences(role: Role): ChatAudience[] {
  return role === "STUDENT" ? ["STUDENT", "ALL"] : ["INSTRUCTOR", "ALL"];
}

/** 챗봇 API의 role 값으로 변환 (ADMIN은 보내지 않는 값이라 학원 관리자로 취급) */
export function toChatRole(role: Role): "STUDENT" | "INSTRUCTOR" | "MANAGER" | "ACADEMY_ADMIN" {
  return role === "ADMIN" ? "ACADEMY_ADMIN" : role;
}
