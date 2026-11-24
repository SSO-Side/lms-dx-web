import { describe, it, expect } from "vitest";
import { Role } from "@prisma/client";
import { ROLE_PERMISSIONS, hasActionPermission, type Action } from "@/lib/access/permissions";
import { visibleAudiences } from "@/lib/ai/audience";

describe("권한 매트릭스 표 순회 테스트", () => {
  const actions = Object.keys(ROLE_PERMISSIONS) as Action[];
  const roles = [
    Role.STUDENT,
    Role.INSTRUCTOR,
    Role.MANAGER,
    Role.ACADEMY_ADMIN,
    Role.ADMIN,
  ];

  it.each(actions)("액션 [%s] 권한 매트릭스 일치 여부 확인", (action) => {
    for (const role of roles) {
      const expected = ROLE_PERMISSIONS[action][role];
      const actual = hasActionPermission(role, action);
      expect(actual).toBe(expected);
    }
  });

  it("정의되지 않은 임의의 액션/역할 조합은 false 반환", () => {
    expect(hasActionPermission(Role.STUDENT, "invalid:action" as Action)).toBe(false);
  });
});

describe("챗봇 권한·문서 대상 (permissions.md)", () => {
  it("chat:ask는 모든 역할, chatDoc:manage는 매니저 이상만", () => {
    for (const r of Object.values(Role)) expect(hasActionPermission(r, "chat:ask")).toBe(true);
    expect(hasActionPermission(Role.STUDENT, "chatDoc:manage")).toBe(false);
    expect(hasActionPermission(Role.INSTRUCTOR, "chatDoc:manage")).toBe(false);
    expect(hasActionPermission(Role.MANAGER, "chatDoc:manage")).toBe(true);
    expect(hasActionPermission(Role.ACADEMY_ADMIN, "chatDoc:manage")).toBe(true);
  });

  it("강사 전용 문서는 수강생에게 검색되지 않는다", () => {
    expect(visibleAudiences(Role.STUDENT)).toEqual(["STUDENT", "ALL"]);
    expect(visibleAudiences(Role.INSTRUCTOR)).toEqual(["INSTRUCTOR", "ALL"]);
    expect(visibleAudiences(Role.MANAGER)).not.toContain("STUDENT");
  });
});
