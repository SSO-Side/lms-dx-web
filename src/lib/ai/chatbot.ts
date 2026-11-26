// 챗봇 어댑터: 서버에서만 호출한다. USE_AI_MOCK=true면 서비스를 부르지 않고, 아니면 CHATBOT_API_URL로 HTTP 호출한다(응답 zod 검증).
// 실패해도 예외 대신 { ok:false }로 돌려 화면의 해당 부분에서만 표시한다. 로그에는 요청 ID와 상태 코드만 남긴다.
import { randomUUID } from "crypto";
import { z } from "zod";
import { env } from "@/lib/config";
import { mockAsk, type MockDoc } from "./mock";
import { chatRequestSchema, chatResponseSchema, serviceDocSchema, type ChatRequest, type ChatResult, type ServiceDoc } from "./types";

const ASK_TIMEOUT_MS = 30_000;
// 서비스는 약 20초 안에 READY 또는 PROCESSING으로 답한다. 먼저 끊으면 LMS에 없는 문서가 서비스에 남으므로 넉넉히 둔다.
const UPLOAD_TIMEOUT_MS = 60_000;
const DELETE_TIMEOUT_MS = 15_000;
// 목록은 화면을 여는 중에 부르므로 짧게 둔다.
const LIST_TIMEOUT_MS = 5_000;
const FAIL = "챗봇 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.";

/** 서비스 호출 공통: 토큰·요청 ID·타임아웃. 설정이 없거나 연결에 실패하면 null. body는 시간 제한 안에서 읽는다 */
async function callService(path: string, init: RequestInit, timeoutMs: number): Promise<{ status: number; ok: boolean; body: unknown } | null> {
  if (!env.CHATBOT_API_URL || !env.CHATBOT_SERVICE_TOKEN) return null;
  const requestId = randomUUID();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${env.CHATBOT_API_URL.replace(/\/$/, "")}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${env.CHATBOT_SERVICE_TOKEN}`, "X-Request-Id": requestId },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) console.error(`[chatbot] ${requestId} ${init.method ?? "GET"} -> ${res.status}`);
    const body: unknown = res.status === 204 ? null : await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, body };
  } catch {
    console.error(`[chatbot] ${requestId} ${init.method ?? "GET"} 연결 실패 또는 시간 초과`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const errorBodySchema = z.object({ error: z.object({ message: z.string().min(1).max(300) }) });

/** 문서 API 오류 → 사용자 문구. 크기·처리 불가·점검(413·422·503)만 서비스 문구를 그대로 보여 준다 */
function docError(res: { status: number; body: unknown } | null): string {
  if (!res || ![413, 422, 503].includes(res.status)) return FAIL;
  const parsed = errorBodySchema.safeParse(res.body);
  return parsed.success ? parsed.data.error.message : FAIL;
}

/** 질문을 보내고 검증된 답변을 돌려준다. */
export async function askChatbot(input: ChatRequest, mockDocs: MockDoc[]): Promise<ChatResult> {
  const req = chatRequestSchema.safeParse(input);
  if (!req.success) return { ok: false, error: "질문은 1~500자로 입력해 주세요." };

  if (env.USE_AI_MOCK) return { ok: true, data: mockAsk(req.data.question, mockDocs) };

  const res = await callService(
    "/api/chat",
    { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(req.data) },
    ASK_TIMEOUT_MS,
  );
  if (res?.status === 429) return { ok: false, error: "질문이 너무 많습니다. 잠시 후 다시 시도해 주세요." };
  if (!res?.ok) return { ok: false, error: FAIL };
  const parsed = chatResponseSchema.safeParse(res.body);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: FAIL };
}

export type UploadDocInput = {
  file: Buffer;
  title: string;
  audience: "STUDENT" | "INSTRUCTOR" | "ALL";
  /** null이면 학원 공통 문서 */
  cohortId: number | null;
  academyId: number;
};

/** PDF를 서비스에 넘긴다. 목 모드면 doc: null (서비스에 없는 문서) */
export async function uploadServiceDoc(input: UploadDocInput): Promise<{ ok: true; doc: ServiceDoc | null } | { ok: false; error: string }> {
  if (env.USE_AI_MOCK) return { ok: true, doc: null };
  const form = new FormData();
  // 원래 파일 이름은 보내지 않는다 (서비스는 확장자만 쓴다)
  form.set("file", new Blob([new Uint8Array(input.file)], { type: "application/pdf" }), "document.pdf");
  form.set("title", input.title);
  form.set("audience", input.audience);
  form.set("academyId", String(input.academyId));
  if (input.cohortId !== null) form.set("cohortId", String(input.cohortId));

  const res = await callService("/api/chat/documents", { method: "POST", body: form }, UPLOAD_TIMEOUT_MS);
  if (!res?.ok) return { ok: false, error: docError(res) };
  const parsed = serviceDocSchema.safeParse(res.body);
  return parsed.success ? { ok: true, doc: parsed.data } : { ok: false, error: FAIL };
}

/** 서비스의 이 학원 문서 목록. 목 모드이거나 실패하면 null */
export async function listServiceDocs(academyId: number): Promise<ServiceDoc[] | null> {
  if (env.USE_AI_MOCK) return null;
  const res = await callService(`/api/chat/documents?academyId=${academyId}`, { method: "GET" }, LIST_TIMEOUT_MS);
  if (!res?.ok) return null;
  const parsed = z.array(serviceDocSchema).safeParse(res.body);
  return parsed.success ? parsed.data : null;
}

/** 서비스에서 문서를 지운다. 404는 이미 지워진 것으로 본다. 호출 전에 학원·반 범위를 확인해야 한다 */
export async function deleteServiceDoc(serviceDocId: number): Promise<{ ok: true } | { ok: false; error: string }> {
  if (env.USE_AI_MOCK) return { ok: true };
  const res = await callService(`/api/chat/documents/${serviceDocId}`, { method: "DELETE" }, DELETE_TIMEOUT_MS);
  if (res && (res.ok || res.status === 404)) return { ok: true };
  return { ok: false, error: docError(res) };
}
