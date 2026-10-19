// 권한 판정 순수 함수 모음: 반 접근, 계정 관리, 파일 열람 등 "이 사람이 이 데이터에 접근해도 되나". DB 없이 테스트한다.
import { Role, type ActiveStatus } from "@prisma/client";

export interface UserAccessInfo {
  id: number;
  role: Role;
  status: ActiveStatus | string;
  mustChangePassword?: boolean;
  academyId: number | null;
}

export interface CohortAccessInfo {
  id: number;
  academyId: number;
}

export interface UserCohortMembership {
  enrolledCohortIds: number[];
  staffCohortIds: number[];
}

/** 이 사용자가 이 반에 들어올 수 있는지(수강생은 재적, 교직원은 배정, 학원 관리자는 같은 학원). */
export function canAccessCohortPure(
  user: UserAccessInfo,
  cohort: CohortAccessInfo | null,
  membership: UserCohortMembership = { enrolledCohortIds: [], staffCohortIds: [] }
): boolean {
  if (!cohort) {
    return false;
  }

  if (user.status !== "ACTIVE") {
    return false;
  }

  if (user.mustChangePassword) {
    return false;
  }

  if (user.role === Role.ADMIN) {
    return true;
  }

  if (user.role === Role.ACADEMY_ADMIN) {
    return user.academyId !== null && user.academyId === cohort.academyId;
  }

  if (user.role === Role.STUDENT) {
    return membership.enrolledCohortIds.includes(cohort.id);
  }

  if (user.role === Role.INSTRUCTOR || user.role === Role.MANAGER) {
    return membership.staffCohortIds.includes(cohort.id);
  }

  return false;
}

export interface ManagedAccountInfo {
  role: Role;
  academyId: number | null;
  /** 이 반의 Enrollment가 ENROLLED 상태인지 */
  enrolledInCohort: boolean;
  /** 이 반의 CohortStaff로 배정되어 있는지 */
  staffInCohort: boolean;
}

/**
 * 반 단위 계정 관리(비밀번호 재설정·비활성화)의 대상이 될 수 있는지 판정한다.
 * 대상은 같은 학원 소속이면서 이 반의 재적 수강생이나 배정 교직원이어야 하고,
 * 학원 관리자·시스템 관리자 계정은 반 단위 관리 대상이 아니다.
 */
export function canManageCohortAccountPure(target: ManagedAccountInfo, cohort: CohortAccessInfo): boolean {
  if (target.role === Role.ACADEMY_ADMIN || target.role === Role.ADMIN) {
    return false;
  }
  if (target.academyId === null || target.academyId !== cohort.academyId) {
    return false;
  }
  if (target.role === Role.STUDENT) {
    return target.enrolledInCohort;
  }
  return target.staffInCohort;
}

export interface DocumentFileAccessInfo {
  /** 서류가 속한 반 */
  cohortId: number;
  ownerId: number;
}

/**
 * 서류 파일(PDF) 열람 가능 여부. 반 접근 확인(requireCohortAccess)을 통과한 뒤의 리소스 단위 검사.
 * 본인 서류이거나, 같은 반의 강사(resume:review)만 허용한다. 매니저·슈퍼어드민은 상태만 보고 파일은 열람하지 못한다.
 */
export function canViewDocumentFilePure(
  actor: { id: number; role: Role },
  ctxCohortId: number,
  doc: DocumentFileAccessInfo
): boolean {
  if (doc.cohortId !== ctxCohortId) return false;
  if (actor.role === Role.ADMIN) return true;
  if (actor.role === Role.STUDENT) return doc.ownerId === actor.id;
  return actor.role === Role.INSTRUCTOR;
}

export interface SubmissionFileAccessInfo {
  /** 제출물이 속한 반 */
  cohortId: number;
  studentId: number;
}

/**
 * 과제 제출 파일 열람 가능 여부. 반 접근 확인(assignment:read)을 통과한 뒤의 리소스 단위 검사.
 * 수강생은 본인 제출물만, 교직원은 같은 반 제출물을 연다 (제출 현황과 같은 범위).
 */
export function canViewSubmissionFilePure(
  actor: { id: number; role: Role },
  ctxCohortId: number,
  sub: SubmissionFileAccessInfo
): boolean {
  if (sub.cohortId !== ctxCohortId) return false;
  if (actor.role === Role.STUDENT) return sub.studentId === actor.id;
  return true;
}

export interface TeamProjectAccessInfo {
  /** 팀이 속한 반 */
  cohortId: number;
  memberIds: number[];
}

/**
 * 팀 프로젝트 수정(기획안·체크·URL·주간 로그) 가능 여부. requireCohortAccess(team:write) 통과 뒤의 리소스 단위 검사.
 * 수강생은 본인이 속한 팀만, ADMIN은 전체. 다른 반 팀은 항상 거부.
 */
export function canEditTeamProjectPure(actor: { id: number; role: Role }, ctxCohortId: number, team: TeamProjectAccessInfo): boolean {
  if (team.cohortId !== ctxCohortId) return false;
  if (actor.role === Role.ADMIN) return true;
  return actor.role === Role.STUDENT && team.memberIds.includes(actor.id);
}

/**
 * 팀 프로젝트 상세 열람 가능 여부. 같은 반 교직원(강사·매니저·슈퍼어드민)은 반 전체, 수강생은 본인 팀만.
 */
export function canViewTeamProjectPure(actor: { id: number; role: Role }, ctxCohortId: number, team: TeamProjectAccessInfo): boolean {
  if (team.cohortId !== ctxCohortId) return false;
  if (actor.role === Role.STUDENT) return team.memberIds.includes(actor.id);
  return true;
}

/**
 * 쇼케이스 이미지(미공개 포함) LMS 내 열람 가능 여부. 반 접근 확인 뒤의 리소스 단위 검사.
 * 같은 반의 팀원·강사·매니저·슈퍼어드민만. 다른 팀 수강생과 다른 반은 거부. 공개 라우트는 이 함수가 아니라 PUBLISHED 조건만 쓴다.
 */
export function canViewShowcaseInternalPure(actor: { id: number; role: Role }, ctxCohortId: number, team: TeamProjectAccessInfo): boolean {
  return canViewTeamProjectPure(actor, ctxCohortId, team);
}
