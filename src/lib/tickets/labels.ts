export const TICKET_TYPE_LABELS = { ABSENCE: "병결·휴가", COUNSELING: "상담", DOCUMENT: "서류", OTHER: "기타" } as const;
export const ABSENCE_REASON_LABELS = { SICK: "병결", LEAVE: "휴가", OTHER: "기타" } as const;
export const TRANSITION_LABELS = {
  IN_REVIEW: "검토 시작",
  APPROVED: "승인",
  REJECTED: "반려",
  NEEDS_REVISION: "보완 요청",
  PENDING: "재제출",
  CANCELED: "접수 취소",
} as const;
