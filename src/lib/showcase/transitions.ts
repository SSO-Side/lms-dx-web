// 쇼케이스 공개 절차 전이표 (M10). 쇼케이스 상태 변경은 이 표 하나만 기준으로 쓴다. 순수 함수.
// 공개 조건: 팀원 전원 동의 + 강사 검토 + 매니저·슈퍼어드민 승인. 기본값은 비공개(DRAFT).
import type { Role, ShowcaseStatus } from "@prisma/client";

/** 역할 + 팀 소속으로 정한 행위자 구분 */
export type ShowcaseActor = "MEMBER" | "INSTRUCTOR" | "APPROVER" | "ADMIN" | "NONE";

export function showcaseActor(role: Role, isMember: boolean): ShowcaseActor {
  if (role === "ADMIN") return "ADMIN";
  if (role === "STUDENT") return isMember ? "MEMBER" : "NONE";
  if (role === "INSTRUCTOR") return "INSTRUCTOR";
  return "APPROVER"; // MANAGER, ACADEMY_ADMIN
}

type Rule = {
  from: ShowcaseStatus;
  to: ShowcaseStatus;
  actors: ShowcaseActor[];
  label: string;
  commentRequired?: boolean;
  /** 공개 승인: 전원 동의 + 강사 검토가 있어야 함 */
  needsConsentAndReview?: boolean;
  /** 신청: 문제 정의가 채워져 있어야 함 */
  needsContent?: boolean;
};

export const SHOWCASE_TRANSITIONS: Rule[] = [
  { from: "DRAFT", to: "IN_REVIEW", actors: ["MEMBER"], label: "공개 신청", needsContent: true },
  { from: "IN_REVIEW", to: "DRAFT", actors: ["MEMBER"], label: "신청 취소" },
  { from: "IN_REVIEW", to: "DRAFT", actors: ["INSTRUCTOR", "APPROVER"], label: "반려", commentRequired: true },
  { from: "IN_REVIEW", to: "PUBLISHED", actors: ["APPROVER"], label: "공개 승인", needsConsentAndReview: true },
  { from: "PUBLISHED", to: "UNPUBLISHED", actors: ["MEMBER", "INSTRUCTOR", "APPROVER"], label: "비공개 전환" },
  { from: "UNPUBLISHED", to: "DRAFT", actors: ["MEMBER"], label: "다시 편집" },
];

export type ShowcaseTransitionCtx = {
  memberCount: number;
  consentCount: number;
  instructorReviewed: boolean;
  hasContent: boolean;
  comment?: string | null;
};

export type ShowcaseTransitionCheck =
  | { ok: true; rule: Rule }
  | { ok: false; reason: "NOT_ALLOWED" | "COMMENT_REQUIRED" | "NEEDS_CONSENT" | "NEEDS_REVIEW" | "NEEDS_CONTENT" };

/** 같은 from→to 규칙이 행위자별로 여러 개일 수 있어(신청 취소/반려) 행위자에 맞는 규칙을 고른다. ADMIN은 행위자 조건만 면제. */
export function canTransitionShowcase(
  from: ShowcaseStatus,
  to: ShowcaseStatus,
  actor: ShowcaseActor,
  ctx: ShowcaseTransitionCtx
): ShowcaseTransitionCheck {
  const rules = SHOWCASE_TRANSITIONS.filter((r) => r.from === from && r.to === to);
  const rule = actor === "ADMIN" ? rules[rules.length - 1] : rules.find((r) => r.actors.includes(actor));
  if (!rule) return { ok: false, reason: "NOT_ALLOWED" };
  if (rule.needsContent && !ctx.hasContent) return { ok: false, reason: "NEEDS_CONTENT" };
  if (rule.needsConsentAndReview) {
    if (!allConsented(ctx.memberCount, ctx.consentCount)) return { ok: false, reason: "NEEDS_CONSENT" };
    if (!ctx.instructorReviewed) return { ok: false, reason: "NEEDS_REVIEW" };
  }
  if (rule.commentRequired && !ctx.comment?.trim()) return { ok: false, reason: "COMMENT_REQUIRED" };
  return { ok: true, rule };
}

/** 화면 버튼용: 현재 상태에서 이 행위자가 할 수 있는 전이 */
export function availableShowcaseTransitions(from: ShowcaseStatus, actor: ShowcaseActor): Rule[] {
  return SHOWCASE_TRANSITIONS.filter((r) => r.from === from && (actor === "ADMIN" || r.actors.includes(actor)));
}

export function allConsented(memberCount: number, consentCount: number): boolean {
  return memberCount > 0 && consentCount >= memberCount;
}

/** 강사 검토(상태 변경 없음): 공개 신청 중이고 아직 검토 전일 때만 */
export function canInstructorReview(status: ShowcaseStatus, actor: ShowcaseActor, reviewed: boolean): boolean {
  return status === "IN_REVIEW" && !reviewed && (actor === "INSTRUCTOR" || actor === "ADMIN");
}

/** 팀원 동의·철회: 신청 중이거나 공개 중일 때만 */
export function canChangeConsent(status: ShowcaseStatus, actor: ShowcaseActor): boolean {
  return (status === "IN_REVIEW" || status === "PUBLISHED") && (actor === "MEMBER" || actor === "ADMIN");
}

/** 내용 편집·이미지 교체: 초안일 때만 (신청 뒤 내용이 바뀌면 동의·검토가 무의미해지므로) */
export function canEditShowcase(status: ShowcaseStatus, actor: ShowcaseActor): boolean {
  return status === "DRAFT" && (actor === "MEMBER" || actor === "ADMIN");
}

/** 공개 중 동의가 철회되면 자동 비공개 (전원 동의 조건이 깨지므로) */
export const STATUS_AFTER_CONSENT_WITHDRAWN: ShowcaseStatus = "UNPUBLISHED";
