// 챗봇 API 요청·응답 타입과 zod 스키마 (docs/ai-integration.md 3.1). 외부 응답은 그대로 믿지 않고 검증한다.
import { z } from "zod";

/** 챗봇 질문 길이 한도 */
export const CHAT_QUESTION_MAX = 500;
/** 근거 없을 때 고정 답변 */
export const CHAT_NO_ANSWER = "확인할 수 없습니다. 담당자에게 문의하세요.";

export const chatRequestSchema = z.object({
  sessionId: z.string().uuid(),
  question: z.string().trim().min(1).max(CHAT_QUESTION_MAX),
  role: z.enum(["STUDENT", "INSTRUCTOR", "MANAGER", "ACADEMY_ADMIN"]),
  cohortId: z.number().int().positive(),
  academyId: z.number().int().positive(),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const chatResponseSchema = z.object({
  answer: z.string(),
  sources: z.array(z.object({ docId: z.number(), title: z.string(), page: z.number().optional() })),
  grounded: z.boolean(),
  suggestedChips: z.array(z.string()).max(5).optional(),
  engineVersion: z.string(),
});
export type ChatResponse = z.infer<typeof chatResponseSchema>;

export type ChatResult = { ok: true; data: ChatResponse } | { ok: false; error: string };
