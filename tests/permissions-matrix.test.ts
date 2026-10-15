import { describe, it, expect } from "vitest";
import { Role } from "@prisma/client";
import { ROLE_PERMISSIONS, hasActionPermission, type Action } from "@/lib/access/permissions";

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
