"use client";

// 서류 검토 드로어(강사): PDF 열람, 코멘트, 완성·수정 요청 처리.
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, MessageSquarePlus, Undo2 } from "lucide-react";
import { getDocumentDetailAction, reviewDocumentAction, addReviewNoteAction } from "@/server/documents";
import type { DocumentDetail } from "@/server/document-queries";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents/labels";
import { availableDocumentTransitions } from "@/lib/documents/transitions";
import { StatusBadge } from "@/components/StatusBadge";
import { StageSteps } from "./StageSteps";
import { VersionList, ReviewNoteList } from "./DocumentHistory";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter } from "@/components/ui/sheet";

/** 강사 서류 드로어: 버전 목록(PDF 열람), 코멘트 작성, 상태 변경 (완성 / 수정 요청은 코멘트 필수). documentId가 null이면 닫힘. */
export function DocumentReviewDrawer({ cohortId, documentId, onClose }: { cohortId: number; documentId: number | null; onClose: () => void }) {
  const router = useRouter();
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [pending, startTransition] = useTransition();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (documentId === null) return;
    let alive = true;
    setDetail(null);
    setError(null);
    setActionError(null);
    getDocumentDetailAction(cohortId, documentId).then((res) => {
      if (!alive) return;
      if (res.ok) setDetail(res.detail);
      else setError(res.error);
    });
    return () => {
      alive = false;
    };
  }, [cohortId, documentId, version]);

  const actions = detail ? availableDocumentTransitions(detail.status, "INSTRUCTOR", false).map((r) => r.to) : [];

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setActionError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return setActionError(res.error);
      setComment("");
      setVersion((v) => v + 1);
      router.refresh();
    });
  };

  return (
    <Sheet
      open={documentId !== null}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setComment("");
        }
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{detail ? detail.title : "서류"}</SheetTitle>
          {detail && (
            <SheetDescription render={<div />} className="flex flex-wrap items-center gap-2">
              <StatusBadge domain="document" value={detail.status} />
              <span>
                {detail.owner.name} · {DOCUMENT_TYPE_LABELS[detail.type]} · 최근 수정 {detail.updatedAt}
              </span>
            </SheetDescription>
          )}
        </SheetHeader>
        <SheetBody className="space-y-5">
          {error && <Alert tone="danger">{error}</Alert>}
          {!detail && !error && (
            <div className="space-y-2" aria-busy="true">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-neutral-100" />
              ))}
            </div>
          )}
          {detail && (
            <>
              <StageSteps status={detail.status} />
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-neutral-900">버전 ({detail.versions.length})</h3>
                <VersionList cohortId={cohortId} versions={detail.versions} />
              </section>
              <section className="space-y-2">
                <Label htmlFor="review-comment">코멘트 {actions.includes("DRAFT") && <span className="font-normal text-neutral-500">(수정 요청 시 필수)</span>}</Label>
                <Textarea
                  id="review-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={2000}
                  className="min-h-28"
                  placeholder="예: 프로젝트 성과를 수치로 적어 보세요. STAR의 R(결과)이 비어 있습니다."
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending || !comment.trim()}
                  onClick={() => detail && run(() => addReviewNoteAction(cohortId, detail.id, comment))}
                >
                  <MessageSquarePlus /> 코멘트만 남기기
                </Button>
              </section>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-neutral-900">코멘트 기록</h3>
                <ReviewNoteList notes={detail.notes} />
              </section>
              {actionError && <Alert tone="danger">{actionError}</Alert>}
            </>
          )}
        </SheetBody>
        {detail && (
          <SheetFooter className="flex-wrap">
            {actions.length === 0 ? (
              <p className="mr-auto text-sm text-neutral-500">
                {detail.status === "DRAFT" ? "수강생이 첨삭을 요청하면 처리할 수 있습니다." : "완성된 서류입니다."}
              </p>
            ) : (
              <>
                {actions.includes("DRAFT") && (
                  <Button
                    variant="outline"
                    disabled={pending || !comment.trim()}
                    title={!comment.trim() ? "코멘트를 입력해 주세요" : undefined}
                    onClick={() => run(() => reviewDocumentAction(cohortId, detail.id, "DRAFT", comment))}
                  >
                    <Undo2 /> 수정 요청
                  </Button>
                )}
                {actions.includes("DONE") && (
                  <Button disabled={pending} onClick={() => run(() => reviewDocumentAction(cohortId, detail.id, "DONE", comment || null))}>
                    <CheckCircle2 /> {pending ? "처리 중…" : "완성 처리"}
                  </Button>
                )}
              </>
            )}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
