// 서류 상태 전이표 (M7). 서류 상태 변경은 이 표 하나만 기준으로 쓴다. 순수 함수.
import type { DocumentStatus, Role } from "@prisma/client";

type Rule = {
  from: DocumentStatus;
  to: DocumentStatus;
  roles: Role[];
  /** 서류 소유자 본인만 */
  ownerOnly?: boolean;
  commentRequired?: boolean;
  /** 버전이 1개 이상 있어야 함 */
  needsVersion?: boolean;
};

export const DOCUMENT_TRANSITIONS: Rule[] = [
  { from: "DRAFT", to: "IN_REVIEW", roles: ["STUDENT"], ownerOnly: true, needsVersion: true }, // 첨삭 요청
  { from: "IN_REVIEW", to: "DONE", roles: ["INSTRUCTOR"] }, // 완성 처리
  { from: "IN_REVIEW", to: "DRAFT", roles: ["INSTRUCTOR"], commentRequired: true }, // 수정 요청
];

/** 새 버전을 올리면 어느 상태에서든 DRAFT로 돌아간다 (전이표 밖의 시스템 전이). */
export const STATUS_AFTER_NEW_VERSION: DocumentStatus = "DRAFT";

export type DocumentTransitionCtx = { isOwner: boolean; versionCount: number; comment?: string | null };
export type DocumentTransitionCheck =
  | { ok: true }
  | { ok: false; reason: "NOT_ALLOWED" | "NOT_OWNER" | "NO_VERSION" | "COMMENT_REQUIRED" };

export function canTransitionDocument(
  from: DocumentStatus,
  to: DocumentStatus,
  actorRole: Role,
  ctx: DocumentTransitionCtx
): DocumentTransitionCheck {
  const rule = DOCUMENT_TRANSITIONS.find((r) => r.from === from && r.to === to);
  if (!rule) return { ok: false, reason: "NOT_ALLOWED" };
  // ADMIN(개발팀)은 역할·소유자 조건만 면제, 나머지 조건은 동일 적용
  if (actorRole !== "ADMIN") {
    if (!rule.roles.includes(actorRole)) return { ok: false, reason: "NOT_ALLOWED" };
    if (rule.ownerOnly && !ctx.isOwner) return { ok: false, reason: "NOT_OWNER" };
  }
  if (rule.needsVersion && ctx.versionCount < 1) return { ok: false, reason: "NO_VERSION" };
  if (rule.commentRequired && !ctx.comment?.trim()) return { ok: false, reason: "COMMENT_REQUIRED" };
  return { ok: true };
}

/** 화면 버튼용: 현재 상태에서 이 역할이 할 수 있는 전이 */
export function availableDocumentTransitions(from: DocumentStatus, actorRole: Role, isOwner: boolean): Rule[] {
  return DOCUMENT_TRANSITIONS.filter(
    (r) => r.from === from && (actorRole === "ADMIN" || (r.roles.includes(actorRole) && (!r.ownerOnly || isOwner)))
  );
}
