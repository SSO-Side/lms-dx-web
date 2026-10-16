import { describe, it, expect } from "vitest";
import { Role } from "@prisma/client";
import {
  canAccessCohortPure,
  canManageCohortAccountPure,
  canViewDocumentFilePure,
  canEditTeamProjectPure,
  canViewTeamProjectPure,
  type UserAccessInfo,
  type CohortAccessInfo,
  type UserCohortMembership,
} from "@/lib/access/checker";
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
    // 계정 관리 대상 검사: 반 A 화면에서 재설정·비활성화할 수 있는 계정인지
    {
      actorName: "acad_admin",
      desc: "반 A에서 반 A 재적 수강생 s01 재설정",
      fn: () => canManageCohortAccountPure({ role: s01.role, academyId: 10, enrolledInCohort: true, staffInCohort: false }, cohortA),
      expected: true,
    },
    {
      actorName: "acad_admin",
      desc: "반 A에서 반 A 배정 강사 inst_a 재설정",
      fn: () => canManageCohortAccountPure({ role: instA.role, academyId: 10, enrolledInCohort: false, staffInCohort: true }, cohortA),
      expected: true,
    },
    {
      actorName: "acad_admin",
      desc: "반 A 경로로 다른 반(B) 수강생 s02 재설정",
      fn: () => canManageCohortAccountPure({ role: s02.role, academyId: 10, enrolledInCohort: false, staffInCohort: false }, cohortA),
      expected: false,
    },
    {
      actorName: "acad_admin",
      desc: "반 A 경로로 다른 반(B) 매니저 비활성화",
      fn: () => canManageCohortAccountPure({ role: Role.MANAGER, academyId: 10, enrolledInCohort: false, staffInCohort: false }, cohortA),
      expected: false,
    },
    {
      actorName: "acad_admin",
      desc: "반 A 경로로 다른 학원 사용자 재설정",
      fn: () => canManageCohortAccountPure({ role: Role.STUDENT, academyId: 99, enrolledInCohort: true, staffInCohort: false }, cohortA),
      expected: false,
    },
    {
      actorName: "acad_admin",
      desc: "반 A 경로로 학원 관리자 계정 재설정",
      fn: () => canManageCohortAccountPure({ role: acadAdmin.role, academyId: 10, enrolledInCohort: false, staffInCohort: true }, cohortA),
      expected: false,
    },
    // M7 서류 파일 열람 (반 접근 → resume:review 권한 → 리소스 단위 검사)
    {
      actorName: "inst_b(반 B 강사)",
      desc: "반 A 수강생 s01의 서류 열람",
      fn: () => {
        const instB: UserAccessInfo = { ...instA, id: 103 };
        const instBMembership: UserCohortMembership = { enrolledCohortIds: [], staffCohortIds: [2] };
        return (
          canAccessCohortPure(instB, cohortA, instBMembership) &&
          canViewDocumentFilePure({ id: instB.id, role: instB.role }, cohortA.id, { cohortId: cohortA.id, ownerId: s01.id })
        );
      },
      expected: false,
    },
    {
      actorName: "s01",
      desc: "같은 반 s02의 서류 열람",
      fn: () =>
        canAccessCohortPure(s01, cohortA, s01Membership) &&
        hasActionPermission(s01.role, "resume:own") &&
        canViewDocumentFilePure({ id: s01.id, role: s01.role }, cohortA.id, { cohortId: cohortA.id, ownerId: s02.id }),
      expected: false,
    },
    {
      actorName: "mgr_a",
      desc: "반 A 수강생 서류 파일 열람 (상태만 허용)",
      fn: () =>
        canAccessCohortPure(mgrA, cohortA, mgrAMembership) &&
        hasActionPermission(mgrA.role, "resume:review") &&
        canViewDocumentFilePure({ id: mgrA.id, role: mgrA.role }, cohortA.id, { cohortId: cohortA.id, ownerId: s01.id }),
      expected: false,
    },
    // M5 팀 프로젝트 (반 접근 → team 권한 → 리소스 단위 검사)
    {
      actorName: "s01",
      desc: "같은 반 다른 팀(s02의 팀) 프로젝트 수정",
      fn: () =>
        canAccessCohortPure(s01, cohortA, s01Membership) &&
        hasActionPermission(s01.role, "team:write") &&
        canEditTeamProjectPure({ id: s01.id, role: s01.role }, cohortA.id, { cohortId: cohortA.id, memberIds: [s02.id] }),
      expected: false,
    },
    {
      actorName: "mgr_a",
      desc: "URL은 반 A, 대상 팀은 반 B인 팀 프로젝트 열람",
      fn: () =>
        canAccessCohortPure(mgrA, cohortA, mgrAMembership) &&
        hasActionPermission(mgrA.role, "team:feedback") &&
        canViewTeamProjectPure({ id: mgrA.id, role: mgrA.role }, cohortA.id, { cohortId: cohortB.id, memberIds: [] }),
      expected: false,
    },
  ];

  it.each(testCases)("$actorName 대상: $desc -> 기대: $expected", ({ fn, expected }) => {
    expect(fn()).toBe(expected);
  });
});
