"use client";

// 챗봇 위젯: 우하단 플로팅 버튼 + 대화창. 서버 액션으로만 질문하고(브라우저가 챗봇 서비스를 직접 부르지 않음),
// 오류·지연은 이 대화창 안에서만 표시한다. 근거가 없는 답변에는 담당자 문의(티켓) 링크를 함께 보여 준다.
import { useRef, useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { MessageCircle, X, Send, FileText, AlertTriangle } from "lucide-react";
import { askChatbotAction } from "@/server/chatbot";
import { CHAT_QUESTION_MAX } from "@/lib/ai/types";
import { Button } from "@/components/ui/button";

type Msg =
  | { from: "user"; text: string }
  | { from: "bot"; text: string; sources: { docId: number; title: string; page?: number | null }[]; grounded: boolean }
  | { from: "error"; text: string };

export function ChatbotWidget({ cohortId }: { cohortId: number }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const sessionId = useRef<string>("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs, pending, open]);

  const send = (text: string) => {
    const q = text.trim();
    if (!q || pending) return;
    if (!sessionId.current) sessionId.current = crypto.randomUUID();
    setMsgs((m) => [...m, { from: "user", text: q }]);
    setInput("");
    startTransition(async () => {
      try {
        const res = await askChatbotAction(cohortId, sessionId.current, q);
        setMsgs((m) => [...m, res.ok ? { from: "bot", text: res.data.answer, sources: res.data.sources, grounded: res.data.grounded } : { from: "error", text: res.error }]);
      } catch {
        setMsgs((m) => [...m, { from: "error", text: "답변을 받지 못했습니다. 잠시 후 다시 시도해 주세요." }]);
      }
    });
  };

  return (
    <>
      {open && (
        <section
          role="dialog"
          aria-label="챗봇"
          className="fixed inset-x-3 bottom-36 z-40 flex h-[min(32rem,calc(100dvh-11rem))] flex-col overflow-hidden rounded-xl border border-neutral-200 bg-card shadow-lg sm:inset-x-auto sm:right-6 sm:w-96 lg:bottom-24 lg:h-[min(34rem,calc(100dvh-8rem))]"
        >
          <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">학원 안내 챗봇</h2>
              <p className="text-xs text-neutral-500">등록된 매뉴얼을 근거로 답변합니다.</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="챗봇 닫기" className="cursor-pointer">
              <X />
            </Button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
            {msgs.length === 0 && (
              <p className="rounded-md bg-neutral-100 px-3 py-2 text-sm text-neutral-600">
                궁금한 점을 물어보세요. 예: 공결 인정 기준이 뭐예요?
                <br />
                <span className="text-xs text-neutral-500">질문에 이름·연락처 같은 개인정보를 입력하지 마세요.</span>
              </p>
            )}
            {msgs.map((m, i) =>
              m.from === "user" ? (
                <div key={i} className="ml-8 rounded-lg bg-primary-500 px-3 py-2 text-sm whitespace-pre-wrap text-white">
                  {m.text}
                </div>
              ) : m.from === "error" ? (
                <div key={i} role="alert" className="flex items-start gap-2 rounded-lg bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {m.text}
                </div>
              ) : (
                <div key={i} className="mr-8 space-y-2 rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-900">
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.sources.length > 0 && (
                    <ul className="space-y-0.5 border-t border-neutral-200 pt-2 text-xs text-neutral-600">
                      {m.sources.map((s) => (
                        <li key={`${s.docId}-${s.page ?? 0}`} className="flex items-center gap-1">
                          <FileText className="size-3.5 shrink-0" aria-hidden />
                          근거: {s.title}
                          {s.page ? ` ${s.page}쪽` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                  {!m.grounded && (
                    <Link href={`/app/c/${cohortId}/tickets`} className="inline-block text-xs font-medium text-primary-500 underline underline-offset-2">
                      담당자에게 문의하기
                    </Link>
                  )}
                </div>
              )
            )}
            {pending && <p className="text-xs text-neutral-500">답변을 찾는 중입니다…</p>}
            <div ref={endRef} />
          </div>

          <form
            className="flex items-center gap-2 border-t border-neutral-200 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={CHAT_QUESTION_MAX}
              placeholder="질문을 입력하세요"
              aria-label="챗봇 질문"
              className="h-10 min-w-0 flex-1 rounded-md border border-neutral-300 bg-card px-3 text-sm text-neutral-900 placeholder:text-neutral-500"
            />
            <Button type="submit" disabled={pending || !input.trim()} aria-label="질문 보내기" className="cursor-pointer">
              <Send />
            </Button>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "챗봇 닫기" : "챗봇 열기"}
        aria-expanded={open}
        className="fixed right-4 bottom-20 z-40 flex size-12 cursor-pointer items-center justify-center rounded-full bg-primary-500 text-white shadow-lg transition-colors duration-150 hover:bg-primary-600 active:bg-primary-700 sm:right-6 lg:bottom-6"
      >
        {open ? <X className="size-5" /> : <MessageCircle className="size-5" />}
      </button>
    </>
  );
}
