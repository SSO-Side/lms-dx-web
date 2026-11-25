// 서류(M7) 입력 양식: 이력서 7항목·자소서 단일 칸(4,000자) 정의와 검증. 순수 함수.
// 이력서 항목 구성은 [TBD: 학원 확정] — 바꿀 때는 RESUME_FIELDS 상수만 고친다.
import { z } from "zod";
import type { DocumentType } from "@prisma/client";

/** 양식으로 작성하는 서류 유형 (포트폴리오는 새로 만들 수 없다) */
export const FORM_DOCUMENT_TYPES = ["RESUME", "COVER_LETTER"] as const satisfies readonly DocumentType[];
export type FormDocumentType = (typeof FORM_DOCUMENT_TYPES)[number];

export function isFormDocumentType(v: unknown): v is FormDocumentType {
  return v === "RESUME" || v === "COVER_LETTER";
}

export type ResumeField = { key: string; label: string; maxLength: number; rows: number; placeholder: string };

/** 이력서 기본 양식(표준 7항목). 모두 텍스트 입력. */
export const RESUME_FIELDS: ResumeField[] = [
  { key: "basic", label: "기본정보", maxLength: 500, rows: 3, placeholder: "이름, 연락처, 이메일, GitHub·포트폴리오 링크" },
  { key: "desiredJob", label: "희망 직무", maxLength: 200, rows: 2, placeholder: "예) 백엔드 개발자 — 데이터로 병목을 찾아 고치는 개발자" },
  { key: "education", label: "학력", maxLength: 1000, rows: 3, placeholder: "학교, 전공, 재학 기간, 졸업 여부" },
  { key: "training", label: "교육 이수 (KDT)", maxLength: 1000, rows: 3, placeholder: "훈련 과정명, 기간, 배운 내용 (수료 예정이면 예정일)" },
  { key: "projects", label: "프로젝트", maxLength: 3000, rows: 8, placeholder: "기간·인원·내 역할 → 문제 → 해결 → 결과(수치)" },
  { key: "skills", label: "기술 스택", maxLength: 1000, rows: 3, placeholder: "실제로 써 본 기술만, 숙련도 순으로" },
  { key: "certificates", label: "자격·수상", maxLength: 1000, rows: 3, placeholder: "자격증, 수상 경력, 어학 점수" },
];

export const COVER_LETTER_MAX_LENGTH = 4000;

/** 자기소개서 기본 양식 (항목 구분 없이 한 칸에 이어서 쓴다. 지우고 써도 된다.) */
export const COVER_LETTER_TEMPLATE = `지원 동기와 직무에 관심을 갖게 된 계기

성장 과정과 강점

프로젝트 경험 (상황 → 내가 한 일 → 결과)

입사 후 포부
`;

const ResumeSchema = z.object(
  Object.fromEntries(RESUME_FIELDS.map((f) => [f.key, z.string().max(f.maxLength, `${f.label}은(는) ${f.maxLength}자 이내로 입력해 주세요.`)]))
);
const CoverLetterSchema = z.object({
  body: z.string().max(COVER_LETTER_MAX_LENGTH, `자기소개서는 ${COVER_LETTER_MAX_LENGTH.toLocaleString()}자 이내로 입력해 주세요.`),
});

export type ResumeContent = Record<string, string>;
export type CoverLetterContent = { body: string };
export type DocumentContent = Record<string, string>;

export type ParsedContent = { ok: true; content: DocumentContent } | { ok: false; error: string };

/** 양식 내용 검증·정리. 모르는 키는 버리고, 비어 있으면 거부한다. */
export function parseDocumentContent(type: FormDocumentType, raw: unknown): ParsedContent {
  const schema = type === "RESUME" ? ResumeSchema : CoverLetterSchema;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "입력값 오류" };
  const content = parsed.data as DocumentContent;
  if (Object.values(content).every((v) => v.trim() === "")) return { ok: false, error: "내용을 입력해 주세요." };
  return { ok: true, content };
}

/** DB의 content(JSON)를 화면용으로 안전하게 읽는다. 형식이 맞지 않으면 null. */
export function readDocumentContent(type: DocumentType, raw: unknown): DocumentContent | null {
  if (raw === null || raw === undefined) return null;
  if (type !== "RESUME" && type !== "COVER_LETTER") return null;
  const r = parseDocumentContent(type, raw);
  return r.ok ? r.content : null;
}

/** 이력서 빈 내용(양식 첫 화면용) */
export function emptyResumeContent(): ResumeContent {
  return Object.fromEntries(RESUME_FIELDS.map((f) => [f.key, ""]));
}
