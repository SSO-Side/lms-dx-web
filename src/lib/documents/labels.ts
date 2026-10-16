import type { DocumentStatus, DocumentType } from "@prisma/client";

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  RESUME: "이력서",
  COVER_LETTER: "자기소개서",
  PORTFOLIO: "포트폴리오",
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  DRAFT: "초안",
  IN_REVIEW: "첨삭 중",
  DONE: "완성",
};

export const DOCUMENT_STATUSES: DocumentStatus[] = ["DRAFT", "IN_REVIEW", "DONE"];

/** 전이 버튼 문구 (to 기준, 역할마다 버튼이 겹치지 않음) */
export const DOCUMENT_TRANSITION_LABELS: Record<DocumentStatus, string> = {
  IN_REVIEW: "첨삭 요청",
  DONE: "완성 처리",
  DRAFT: "수정 요청",
};

export const AI_CONSENT_TEXT = "이 서류가 AI 면접 질문 생성에 사용될 수 있습니다. 이름·연락처는 외부 전송 전 제거됩니다.";
