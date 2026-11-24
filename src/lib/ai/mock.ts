// 챗봇 목 응답 (USE_AI_MOCK=true). 규격(ai-integration.md 3.1)과 같은 모양이며, 접근 가능한 문서가 있으면 근거 있음, 없으면 근거 없음으로 답한다.
import { CHAT_NO_ANSWER, type ChatResponse } from "./types";

export interface MockDoc {
  id: number;
  title: string;
}

/** 목 답변을 만든다. docs는 질문자가 볼 수 있는 문서(서버가 권한·반 범위로 거른 것). */
export function mockAsk(question: string, docs: MockDoc[]): ChatResponse {
  if (docs.length === 0) {
    return { answer: CHAT_NO_ANSWER, sources: [], grounded: false, suggestedChips: [], engineVersion: "mock-v1" };
  }
  const doc = docs[0];
  return {
    answer: `[목 응답] "${question.slice(0, 40)}"에 대한 안내는 「${doc.title}」 문서를 참고해 주세요. 실제 챗봇 서비스가 연결되면 문서 내용을 근거로 답변합니다.`,
    sources: [{ docId: doc.id, title: doc.title, page: 1 }],
    grounded: true,
    suggestedChips: ["출석 인정 기준", "공결 신청 방법"],
    engineVersion: "mock-v1",
  };
}
