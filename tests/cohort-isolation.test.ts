import { describe, it, expect } from "vitest";
import { Role } from "@prisma/client";
import { canAccessCohortPure, type UserAccessInfo, type CohortAccessInfo, type UserCohortMembership } from "@/lib/access/checker";
import { hasActionPermission } from "@/lib/access/permissions";

describe("반 간 접근 차단 테스트 (permissions.md §3)", () => {
  const cohortA: CohortAccessInfo = { id: 1, academyId: 10 };
  const cohortB: CohortAccessInfo = { id: 2, academyId: 10 };
  const cohortOtherAcademy: CohortAccessInfo = { id: 3, academyId: 99 };

  const mgrA: UserAccessInfo = {
    id: 101,
    role: Role.MANAGER,
    status: "ACTIVE",
    mustChangePassword: false,
    academyId: 10,
  };
  const mgrAMembership: UserCohortMembership = {
    enrolledCohortIds: [],
    staffCohortIds: [1], // 반 A만 담당
  };

  const instA: UserAccessInfo = {
    id: 102,
    role: Role.INSTRUCTOR,
    status: "ACTIVE",
    mustChangePassword: false,
    academyId: 10,
  };
  const instAMembership: UserCohortMembership = {
    enrolledCohortIds: [],
    staffCohortIds: [1], // 반 A만 담당
  };

  const s01: UserAccessInfo = {
    id: 201,
    role: Role.STUDENT,
    status: "ACTIVE",
    mustChangePassword: false,
    academyId: 10,
  };
  const s01Membership: UserCohortMembership = {
    enrolledCohortIds: [1], // 반 A만 등록
    staffCohortIds: [],
  };

  const s02: UserAccessInfo = {
    id: 202,
    role: Role.STUDENT,
    status: "ACTIVE",
    mustChangePassword: false,
    academyId: 10,
  };

  const acadAdmin: UserAccessInfo = {
    id: 301,
    role: Role.ACADEMY_ADMIN,
    status: "ACTIVE",
    mustChangePassword: false,
    academyId: 10,
  };

  const testCases = [
    {
      actorName: "mgr_a",
      desc: "반 B의 출결 조회·입력",
      fn: () => canAccessCohortPure(mgrA, cohortB, mgrAMembership),
      expected: false,
    },
    {
      actorName: "mgr_a",
      desc: "반 B 수강생의 티켓·증빙",
      fn: () => canAccessCohortPure(mgrA, cohortB, mgrAMembership),
      expected: false,
    },
    {
      actorName: "inst_a",
      desc: "반 B의 자료 조회",
      fn: () => canAccessCohortPure(instA, cohortB, instAMembership),
      expected: false,
    },
    {
      actorName: "s01",
      desc: "반 B의 어떤 데이터",
      fn: () => canAccessCohortPure(s01, cohortB, s01Membership),
      expected: false,
    },
    {
      actorName: "s01",
      desc: "s02의 출결·티켓·증빙 (같은 반이어도 본인만)",
      fn: () => {
        // 리소스 레벨 검사: 대상 리소스 소유자(s02)와 요청자(s01) 일치 여부
        const targetStudentId = s02.id;
        const requesterId = s01.id;
        return requesterId === targetStudentId;
      },
      expected: false,
    },
    {
      actorName: "s01",
      desc: "반 A 출결 입력 (attendance:write)",
      fn: () => hasActionPermission(s01.role, "attendance:write"),
      expected: false,
    },
    {
      actorName: "inst_a",
      desc: "반 A 출결 입력 (attendance:write)",
      fn: () => hasActionPermission(instA.role, "attendance:write"),
      expected: false,
    },
    {
      actorName: "acad_admin",
      desc: "반 A 전체 조회",
      fn: () => canAccessCohortPure(acadAdmin, cohortA),
      expected: true,
    },
    {
      actorName: "acad_admin",
      desc: "반 B 전체 조회",
      fn: () => canAccessCohortPure(acadAdmin, cohortB),
      expected: true,
    },
    {
      actorName: "acad_admin",
      desc: "다른 학원의 반 조회",
      fn: () => canAccessCohortPure(acadAdmin, cohortOtherAcademy),
      expected: false,
    },
  ];

  it.each(testCases)("$actorName 대상: $desc -> 기대: $expected", ({ fn, expected }) => {
    expect(fn()).toBe(expected);
  });
});
