// 티켓 상태 전이 (docs/spec/ticket-state.md 전이표가 유일한 기준). 순수 함수.
import type { Role, TicketStatus } from "@prisma/client";

type Rule = {
  from: TicketStatus;
  to: TicketStatus;
  roles: Role[];
  /** 요청자 본인만 */
  requesterOnly?: boolean;
  commentRequired?: boolean;
};

const STAFF: Role[] = ["INSTRUCTOR", "MANAGER", "ACADEMY_ADMIN"];

/** 티켓 상태 전이표(docs/spec/ticket-state.md와 같은 단일 기준). */
export const TRANSITIONS: Rule[] = [
  { from: "PENDING", to: "IN_REVIEW", roles: STAFF },
  { from: "IN_REVIEW", to: "APPROVED", roles: STAFF },
  { from: "IN_REVIEW", to: "REJECTED", roles: STAFF, commentRequired: true },
  { from: "IN_REVIEW", to: "NEEDS_REVISION", roles: STAFF, commentRequired: true },
  { from: "NEEDS_REVISION", to: "PENDING", roles: ["STUDENT"], requesterOnly: true },
  { from: "PENDING", to: "CANCELED", roles: ["STUDENT"], requesterOnly: true },
];

export type TransitionCtx = { isRequester: boolean; comment?: string | null };
export type TransitionCheck = { ok: true } | { ok: false; reason: "NOT_ALLOWED" | "NOT_REQUESTER" | "COMMENT_REQUIRED" };

/** 이 역할이 티켓 상태를 from → to로 바꿀 수 있는지 전이표에서 찾는다. */
export function canTransition(from: TicketStatus, to: TicketStatus, actorRole: Role, ctx: TransitionCtx): TransitionCheck {
  const rule = TRANSITIONS.find((r) => r.from === from && r.to === to);
  if (!rule) return { ok: false, reason: "NOT_ALLOWED" };
  // ADMIN(개발팀)은 모든 전이 가능, 조건은 동일 적용
  if (actorRole !== "ADMIN") {
    if (!rule.roles.includes(actorRole)) return { ok: false, reason: "NOT_ALLOWED" };
    if (rule.requesterOnly && !ctx.isRequester) return { ok: false, reason: "NOT_REQUESTER" };
  }
  if (rule.commentRequired && !ctx.comment?.trim()) return { ok: false, reason: "COMMENT_REQUIRED" };
  return { ok: true };
}

/** 화면 버튼용: 현재 상태에서 이 역할이 할 수 있는 전이 */
export function availableTransitions(from: TicketStatus, actorRole: Role, isRequester: boolean): Rule[] {
  return TRANSITIONS.filter(
    (r) => r.from === from && (actorRole === "ADMIN" || (r.roles.includes(actorRole) && (!r.requesterOnly || isRequester)))
  );
}

/** 더 바뀌지 않는 마지막 상태들 */
export const TERMINAL_STATUSES: TicketStatus[] = ["APPROVED", "REJECTED", "CANCELED"];
