// 챗봇 어댑터: 서버에서만 호출한다. USE_AI_MOCK=true면 목 응답, 아니면 CHATBOT_API_URL로 HTTP 호출(타임아웃 30초, 응답 zod 검증).
// 외부 서비스 규격은 미확정(v0.1)이라 질의응답만 구현했다. 문서 인제스트·삭제 연동은 규격 확정 후 추가한다.
import { randomUUID } from "crypto";
import { env } from "@/lib/config";
import { mockAsk, type MockDoc } from "./mock";
import { chatRequestSchema, chatResponseSchema, type ChatRequest, type ChatResult } from "./types";

const TIMEOUT_MS = 30_000;
const FAIL = "챗봇 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.";

/** 질문을 보내고 검증된 답변을 돌려준다. 실패해도 예외 대신 { ok:false }로 돌려 화면의 위젯 안에서만 표시한다. */
export async function askChatbot(input: ChatRequest, mockDocs: MockDoc[]): Promise<ChatResult> {
  const req = chatRequestSchema.safeParse(input);
  if (!req.success) return { ok: false, error: "질문은 1~500자로 입력해 주세요." };

  if (env.USE_AI_MOCK) return { ok: true, data: mockAsk(req.data.question, mockDocs) };

  if (!env.CHATBOT_API_URL || !env.CHATBOT_SERVICE_TOKEN) return { ok: false, error: FAIL };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${env.CHATBOT_API_URL.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${env.CHATBOT_SERVICE_TOKEN}`,
        "X-Request-Id": randomUUID(),
      },
      body: JSON.stringify(req.data),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      if (res.status === 429) return { ok: false, error: "질문이 너무 많습니다. 잠시 후 다시 시도해 주세요." };
      return { ok: false, error: FAIL };
    }
    const parsed = chatResponseSchema.safeParse(await res.json());
    return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: FAIL };
  } catch {
    return { ok: false, error: FAIL };
  } finally {
    clearTimeout(timer);
  }
}
