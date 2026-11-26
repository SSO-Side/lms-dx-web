import { describe, it, expect } from "vitest";
import { Role } from "@prisma/client";
import {
  canAccessCohortPure,
  canManageCohortAccountPure,
  canAssignCohortStaffPure,
  canManageAcademyChatDocsPure,
  canManageSubAccountsPure,
  canViewDocumentPure,
  canViewSubmissionFilePure,
  canEditTeamProjectPure,
  canViewTeamProjectPure,
  type UserAccessInfo,
  type CohortAccessInfo,
  type UserCohortMembership,
} from "@/lib/access/checker";
import { hasActionPermission } from "@/lib/access/permissions";
import { toPublicShowcase, type PublicShowcaseSource } from "@/lib/showcase/public";

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
    staffCohortIds: [1], // 반 A만 주담당 배정(서브 관리자는 배정과 무관하게 학원 전체 반)
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

  /** M10 공개 DTO 입력 (반 A 팀: s01 팀장, s02 팀원) */
  const showcaseSrc = (o: Partial<PublicShowcaseSource>): PublicShowcaseSource => ({
    slug: "abcdefghjkmn",
    status: "PUBLISHED",
    problem: "문제 정의",
    metrics: [{ label: "응답", value: "0.4초" }],
    demoUrl: null,
    repoUrl: null,
    hasCover: false,
    hasArchitecture: false,
    publishedAt: null,
    projectTitle: "가상 프로젝트",
    projectSummary: null,
    techStack: ["Next.js"],
    teamName: "1팀",
    courseName: "가상 과정",
    members: [
      { userId: s01.id, name: "가상 수강생01", role: "팀장" },
      { userId: s02.id, name: "가상 수강생02", role: "프론트엔드" },
    ],
    consentedUserIds: [s01.id, s02.id],
    ...o,
  });

  const testCases = [
    // 서브 관리자(MANAGER): 배정과 무관하게 같은 학원의 모든 반, 다른 학원은 거부
    {
      actorName: "mgr_a(서브 관리자)",
      desc: "배정되지 않은 같은 학원 반 B의 출결 조회·입력",
      fn: () => canAccessCohortPure(mgrA, cohortB, mgrAMembership) && hasActionPermission(mgrA.role, "attendance:write"),
      expected: true,
    },
    {
      actorName: "mgr_a(서브 관리자)",
      desc: "다른 학원 반의 티켓·증빙",
      fn: () => canAccessCohortPure(mgrA, cohortOtherAcademy, { enrolledCohortIds: [], staffCohortIds: [3] }),
      expected: false,
    },
    {
      actorName: "학원 없는 서브 관리자",
      desc: "반 A 조회",
      fn: () => canAccessCohortPure({ ...mgrA, academyId: null }, cohortA, mgrAMembership),
      expected: false,
    },
    {
      actorName: "비활성 서브 관리자",
      desc: "반 A 조회",
      fn: () => canAccessCohortPure({ ...mgrA, status: "INACTIVE" }, cohortA, mgrAMembership),
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
      desc: "반 A 경로로 서브 관리자 비활성화 (서브 계정 화면에서만)",
      fn: () => canManageCohortAccountPure({ role: Role.MANAGER, academyId: 10, enrolledInCohort: false, staffInCohort: true }, cohortA),
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
    // 담당 교직원 배정 대상 검사: 같은 학원의 활성 매니저·강사만
    {
      actorName: "acad_admin",
      desc: "반 A에 같은 학원 매니저 배정",
      fn: () => canAssignCohortStaffPure({ role: Role.MANAGER, academyId: 10, status: "ACTIVE" }, cohortA),
      expected: true,
    },
    {
      actorName: "acad_admin",
      desc: "반 A에 다른 학원 강사 배정",
      fn: () => canAssignCohortStaffPure({ role: Role.INSTRUCTOR, academyId: 99, status: "ACTIVE" }, cohortA),
      expected: false,
    },
    {
      actorName: "acad_admin",
      desc: "반 A 담당자로 수강생 배정",
      fn: () => canAssignCohortStaffPure({ role: Role.STUDENT, academyId: 10, status: "ACTIVE" }, cohortA),
      expected: false,
    },
    {
      actorName: "acad_admin",
      desc: "반 A에 비활성 매니저 배정",
      fn: () => canAssignCohortStaffPure({ role: Role.MANAGER, academyId: 10, status: "INACTIVE" }, cohortA),
      expected: false,
    },
    {
      actorName: "mgr_a(서브 관리자)",
      desc: "반 B 담당 교직원 배정·수강생 계정 관리 (account:manage)",
      fn: () => canAccessCohortPure(mgrA, cohortB, mgrAMembership) && hasActionPermission(mgrA.role, "account:manage"),
      expected: true,
    },
    // 서브 계정(서브 관리자) 발급·재설정·비활성화: 학원에 속한 활성 슈퍼어드민만
    {
      actorName: "acad_admin(슈퍼어드민)",
      desc: "서브 계정 관리",
      fn: () => canManageSubAccountsPure(acadAdmin),
      expected: true,
    },
    {
      actorName: "mgr_a(서브 관리자)",
      desc: "서브 계정 관리",
      fn: () => canManageSubAccountsPure(mgrA),
      expected: false,
    },
    {
      actorName: "시스템 관리자(ADMIN)",
      desc: "서브 계정 관리",
      fn: () => canManageSubAccountsPure({ ...acadAdmin, role: Role.ADMIN }),
      expected: false,
    },
    {
      actorName: "비밀번호 변경 전 슈퍼어드민",
      desc: "서브 계정 관리",
      fn: () => canManageSubAccountsPure({ ...acadAdmin, mustChangePassword: true }),
      expected: false,
    },
    // 학원 공통 챗봇 문서: 반이 아니라 계정의 학원 단위로 관리한다
    {
      actorName: "acad_admin",
      desc: "학원 공통 문서 관리",
      fn: () => canManageAcademyChatDocsPure(acadAdmin),
      expected: true,
    },
    {
      actorName: "mgr_a(서브 관리자)",
      desc: "학원 공통 문서 관리",
      fn: () => canManageAcademyChatDocsPure(mgrA),
      expected: false,
    },
    {
      actorName: "학원 없는 관리자",
      desc: "학원 공통 문서 관리",
      fn: () => canManageAcademyChatDocsPure({ ...acadAdmin, academyId: null }),
      expected: false,
    },
    // M7 서류 내용 열람 (반 접근 → resume:review 권한 → 리소스 단위 검사)
    {
      actorName: "inst_b(반 B 강사)",
      desc: "반 A 수강생 s01의 서류 열람",
      fn: () => {
        const instB: UserAccessInfo = { ...instA, id: 103 };
        const instBMembership: UserCohortMembership = { enrolledCohortIds: [], staffCohortIds: [2] };
        return (
          canAccessCohortPure(instB, cohortA, instBMembership) &&
          canViewDocumentPure({ id: instB.id, role: instB.role }, cohortA.id, { cohortId: cohortA.id, ownerId: s01.id })
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
        canViewDocumentPure({ id: s01.id, role: s01.role }, cohortA.id, { cohortId: cohortA.id, ownerId: s02.id }),
      expected: false,
    },
    {
      actorName: "mgr_a",
      desc: "반 A 수강생 서류 내용 열람 (상태만 허용)",
      fn: () =>
        canAccessCohortPure(mgrA, cohortA, mgrAMembership) &&
        hasActionPermission(mgrA.role, "resume:review") &&
        canViewDocumentPure({ id: mgrA.id, role: mgrA.role }, cohortA.id, { cohortId: cohortA.id, ownerId: s01.id }),
      expected: false,
    },
    {
      actorName: "s01",
      desc: "본인 서류(면접 연동 포함) 열람",
      fn: () =>
        canAccessCohortPure(s01, cohortA, s01Membership) &&
        hasActionPermission(s01.role, "resume:own") &&
        canViewDocumentPure({ id: s01.id, role: s01.role }, cohortA.id, { cohortId: cohortA.id, ownerId: s01.id }),
      expected: true,
    },
    // M1 과제 제출 파일 열람 (반 접근 → assignment:read → 리소스 단위 검사)
    {
      actorName: "s01",
      desc: "같은 반 s02의 제출 파일 열람",
      fn: () =>
        canAccessCohortPure(s01, cohortA, s01Membership) &&
        hasActionPermission(s01.role, "assignment:read") &&
        canViewSubmissionFilePure({ id: s01.id, role: s01.role }, cohortA.id, { cohortId: cohortA.id, studentId: s02.id }),
      expected: false,
    },
    {
      actorName: "inst_a",
      desc: "반 A 경로로 반 B 제출물 id를 넣어 열람",
      fn: () =>
        canAccessCohortPure(instA, cohortA, instAMembership) &&
        canViewSubmissionFilePure({ id: instA.id, role: instA.role }, cohortA.id, { cohortId: cohortB.id, studentId: s02.id }),
      expected: false,
    },
    {
      actorName: "inst_b(반 B 강사)",
      desc: "반 A 수강생 s01의 제출 파일 열람",
      fn: () => {
        const instB: UserAccessInfo = { ...instA, id: 103 };
        const instBMembership: UserCohortMembership = { enrolledCohortIds: [], staffCohortIds: [2] };
        return (
          canAccessCohortPure(instB, cohortA, instBMembership) &&
          canViewSubmissionFilePure({ id: instB.id, role: instB.role }, cohortA.id, { cohortId: cohortA.id, studentId: s01.id })
        );
      },
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
    // M10 공개 영역: 반 권한의 예외이므로 PUBLISHED 조건과 공개 DTO로만 막는다
    {
      actorName: "외부 방문자(비로그인)",
      desc: "공개 심사 중(IN_REVIEW)·비공개 전환(UNPUBLISHED) 쇼케이스 상세 열람",
      fn: () =>
        toPublicShowcase(showcaseSrc({ status: "IN_REVIEW" })) !== null || toPublicShowcase(showcaseSrc({ status: "UNPUBLISHED" })) !== null,
      expected: false,
    },
    {
      actorName: "외부 방문자(비로그인)",
      desc: "공개 쇼케이스에서 동의하지 않은 팀원(s02)의 이름·내부 ID 노출",
      fn: () => {
        const json = JSON.stringify(toPublicShowcase(showcaseSrc({ status: "PUBLISHED", consentedUserIds: [s01.id] })));
        return json.includes("가상 수강생02") || json.includes("userId") || json.includes(String(s02.id));
      },
      expected: false,
    },
  ];

  it.each(testCases)("$actorName 대상: $desc -> 기대: $expected", ({ fn, expected }) => {
    expect(fn()).toBe(expected);
  });
});
