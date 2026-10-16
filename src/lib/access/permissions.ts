import { Role } from "@prisma/client";

export type Action =
  | "material:read"
  | "assignment:read"
  | "material:write"
  | "assignment:write"
  | "submission:create"
  | "ticket:create"
  | "ticket:process"
  | "ticket:readOwn"
  | "ticket:readCohort"
  | "absenceProof:read"
  | "attendance:write"
  | "attendance:readCohort"
  | "attendance:readOwn"
  | "chat:ask"
  | "chatDoc:manage"
  | "resume:own"
  | "resume:readOthers"
  | "resume:review"
  | "team:feedback"
  | "showcase:apply"
  | "showcase:review"
  | "showcase:approve"
  | "lead:read"
  | "account:manage";

export const ROLE_PERMISSIONS: Record<Action, Record<Role, boolean>> = {
  "material:read": {
    STUDENT: true,
    INSTRUCTOR: true,
    MANAGER: true,
    ACADEMY_ADMIN: true,
    ADMIN: true,
  },
  "assignment:read": {
    STUDENT: true,
    INSTRUCTOR: true,
    MANAGER: true,
    ACADEMY_ADMIN: true,
    ADMIN: true,
  },
  "material:write": {
    STUDENT: false,
    INSTRUCTOR: true,
    MANAGER: false,
    ACADEMY_ADMIN: false,
    ADMIN: true,
  },
  "assignment:write": {
    STUDENT: false,
    INSTRUCTOR: true,
    MANAGER: false,
    ACADEMY_ADMIN: false,
    ADMIN: true,
  },
  "submission:create": {
    STUDENT: true,
    INSTRUCTOR: false,
    MANAGER: false,
    ACADEMY_ADMIN: false,
    ADMIN: true,
  },
  "ticket:create": {
    STUDENT: true,
    INSTRUCTOR: false,
    MANAGER: false,
    ACADEMY_ADMIN: false,
    ADMIN: true,
  },
  "ticket:process": {
    STUDENT: false,
    INSTRUCTOR: true,
    MANAGER: true,
    ACADEMY_ADMIN: true,
    ADMIN: true,
  },
  "ticket:readOwn": {
    STUDENT: true,
    INSTRUCTOR: false,
    MANAGER: false,
    ACADEMY_ADMIN: false,
    ADMIN: true,
  },
  "ticket:readCohort": {
    STUDENT: false,
    INSTRUCTOR: true,
    MANAGER: true,
    ACADEMY_ADMIN: true,
    ADMIN: true,
  },
  "absenceProof:read": {
    STUDENT: true, // 본인만 (리소스 단위 검사로 추가 검증)
    INSTRUCTOR: false,
    MANAGER: true,
    ACADEMY_ADMIN: true,
    ADMIN: true,
  },
  "attendance:write": {
    STUDENT: false,
    INSTRUCTOR: false,
    MANAGER: true,
    ACADEMY_ADMIN: true,
    ADMIN: true,
  },
  "attendance:readCohort": {
    STUDENT: false,
    INSTRUCTOR: true,
    MANAGER: true,
    ACADEMY_ADMIN: true,
    ADMIN: true,
  },
  "attendance:readOwn": {
    STUDENT: true,
    INSTRUCTOR: false,
    MANAGER: false,
    ACADEMY_ADMIN: false,
    ADMIN: true,
  },
  "chat:ask": {
    STUDENT: true,
    INSTRUCTOR: true,
    MANAGER: true,
    ACADEMY_ADMIN: true,
    ADMIN: true,
  },
  "chatDoc:manage": {
    STUDENT: false,
    INSTRUCTOR: false,
    MANAGER: true,
    ACADEMY_ADMIN: true,
    ADMIN: true,
  },
  "resume:own": {
    STUDENT: true,
    INSTRUCTOR: false,
    MANAGER: false,
    ACADEMY_ADMIN: false,
    ADMIN: true,
  },
  "resume:readOthers": {
    STUDENT: false,
    INSTRUCTOR: true, // 같은 반 수강생 (배정 개념 도입 전 단순화)
    MANAGER: true, // 상태만
    ACADEMY_ADMIN: true, // 상태만
    ADMIN: true,
  },
  // 서류 파일 열람·코멘트·상태 변경 (매니저·슈퍼어드민은 상태만 보므로 X)
  "resume:review": {
    STUDENT: false,
    INSTRUCTOR: true,
    MANAGER: false,
    ACADEMY_ADMIN: false,
    ADMIN: true,
  },
  "team:feedback": {
    STUDENT: true, // 열람
    INSTRUCTOR: true,
    MANAGER: true, // 열람
    ACADEMY_ADMIN: true, // 열람
    ADMIN: true,
  },
  "showcase:apply": {
    STUDENT: true,
    INSTRUCTOR: false,
    MANAGER: false,
    ACADEMY_ADMIN: false,
    ADMIN: true,
  },
  "showcase:review": {
    STUDENT: false,
    INSTRUCTOR: true,
    MANAGER: false,
    ACADEMY_ADMIN: false,
    ADMIN: true,
  },
  "showcase:approve": {
    STUDENT: false,
    INSTRUCTOR: false,
    MANAGER: true,
    ACADEMY_ADMIN: true,
    ADMIN: true,
  },
  "lead:read": {
    STUDENT: false,
    INSTRUCTOR: false,
    MANAGER: true,
    ACADEMY_ADMIN: true,
    ADMIN: true,
  },
  "account:manage": {
    STUDENT: false,
    INSTRUCTOR: false,
    MANAGER: false,
    ACADEMY_ADMIN: true,
    ADMIN: true,
  },
};

export function hasActionPermission(role: Role, action: Action): boolean {
  return ROLE_PERMISSIONS[action]?.[role] ?? false;
}
