"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TicketStatus } from "@prisma/client";
import { getTicketDetailAction, transitionTicketAction } from "@/server/tickets";
import type { TicketDetail } from "@/server/ticket-queries";
import { TICKET_TYPE_LABELS, ABSENCE_REASON_LABELS, TRANSITION_LABELS } from "@/lib/tickets/labels";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ProofDialog, ProofList } from "./ProofDialog";

const ACTION_VARIANT: Partial<Record<TicketStatus, "default" | "outline" | "destructive-outline">> = {
  APPROVED: "default",
  IN_REVIEW: "default",
  PENDING: "default",
  REJECTED: "destructive-outline",
  NEEDS_REVISION: "outline",
  CANCELED: "destructive-outline",
};
// 확인 모달이 필요한 처리 (반려·보완은 사유 필수, 취소는 되돌릴 수 없음, 재제출은 보완 내용 입력)
const NEEDS_DIALOG: TicketStatus[] = ["REJECTED", "NEEDS_REVISION", "CANCELED", "PENDING"];

/** 티켓 상세·이력·증빙·처리 드로어 (ia.md §3). ticketId가 null이면 닫힘. */
export function TicketDrawer({ cohortId, ticketId, onClose }: { cohortId: number; ticketId: number | null; onClose: () => void }) {
  const router = useRouter();
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ to: TicketStatus; commentRequired: boolean } | null>(null);
  const [comment, setComment] = useState("");
  const [proofOpen, setProofOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (ticketId === null) return;
    let alive = true;
    setDetail(null);
    setError(null);
    setActionError(null);
    getTicketDetailAction(cohortId, ticketId).then((res) => {
      if (!alive) return;
      if (res.ok) setDetail(res.detail);
      else setError(res.error);
    });
    return () => {
      alive = false;
    };
  }, [cohortId, ticketId, version]);

  const run = (to: TicketStatus, text?: string, form?: FormData) => {
    if (!detail) return;
    setActionError(null);
    startTransition(async () => {
      const res = await transitionTicketAction(cohortId, detail.id, to, text ?? null, form);
      if (!res.ok) {
        setActionError(res.error);
        return;
      }
      setDialog(null);
      setComment("");
      setVersion((v) => v + 1);
      router.refresh();
    });
  };

  return (
    <Sheet open={ticketId !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{detail ? detail.title : `티켓 #${ticketId ?? ""}`}</SheetTitle>
          {detail && (
            <SheetDescription render={<div />} className="flex flex-wrap items-center gap-2">
              <StatusBadge domain="ticket" value={detail.status} />
              <span>
                #{detail.id} · {TICKET_TYPE_LABELS[detail.type]} · {detail.createdAt}
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
              <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2 text-sm">
                <dt className="text-neutral-500">요청자</dt>
                <dd className="text-neutral-900">
                  {detail.requester.name} <span className="text-neutral-500">({detail.requester.loginId})</span>
                </dd>
                <dt className="text-neutral-500">담당</dt>
                <dd className="text-neutral-900">{detail.assigneeName ?? "미지정 (학원 관리자)"}</dd>
                {detail.absence && (
                  <>
                    <dt className="text-neutral-500">결석 일자</dt>
                    <dd className="text-neutral-900 tabular-nums">{detail.absence.absentDate}</dd>
                    <dt className="text-neutral-500">사유</dt>
                    <dd className="text-neutral-900">
                      {ABSENCE_REASON_LABELS[detail.absence.reasonType]}
                      {detail.absence.linked && <span className="ml-2 text-xs text-status-success-fg">출결에 공결로 반영됨</span>}
                      {detail.absence.reasonType === "OTHER" && <span className="ml-2 text-xs text-neutral-500">(기타 사유는 공결 처리되지 않음)</span>}
                    </dd>
                  </>
                )}
              </dl>

              {detail.body && <p className="rounded-lg bg-neutral-50 p-3 text-sm whitespace-pre-wrap text-neutral-800">{detail.body}</p>}

              {detail.type === "ABSENCE" && (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-neutral-900">증빙</h3>
                  {detail.attachments === null ? (
                    <p className="text-sm text-neutral-500">증빙 {detail.attachmentCount}건 · 열람 권한이 없습니다.</p>
                  ) : detail.attachments.length === 0 ? (
                    <p className="text-sm text-neutral-500">첨부된 증빙이 없습니다.</p>
                  ) : (
                    <>
                      <ProofList cohortId={cohortId} attachments={detail.attachments} />
                      <Button variant="link" size="sm" onClick={() => setProofOpen(true)}>
                        크게 보기
                      </Button>
                    </>
                  )}
                </section>
              )}

              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-neutral-900">처리 이력</h3>
                <ol className="relative space-y-3 border-l border-neutral-200 pl-4">
                  {detail.events.map((e) => (
                    <li key={e.id} className="text-sm">
                      <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border-2 border-card bg-primary-500" aria-hidden />
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge domain="ticket" value={e.to} />
                        <span className="text-neutral-700">{e.actorName}</span>
                        <span className="text-xs text-neutral-500 tabular-nums">{e.createdAt}</span>
                      </div>
                      {e.comment && <p className="mt-1 rounded-md bg-neutral-50 px-2 py-1.5 whitespace-pre-wrap text-neutral-700">{e.comment}</p>}
                    </li>
                  ))}
                </ol>
              </section>
              {actionError && !dialog && <Alert tone="danger">{actionError}</Alert>}
            </>
          )}
        </SheetBody>
        {detail && detail.actions.length > 0 && (
          <SheetFooter className="flex-wrap">
            {[...detail.actions].reverse().map((a) => (
              <Button
                key={a.to}
                variant={ACTION_VARIANT[a.to] ?? "outline"}
                disabled={pending}
                onClick={() => (NEEDS_DIALOG.includes(a.to) ? setDialog(a) : run(a.to))}
              >
                {TRANSITION_LABELS[a.to as keyof typeof TRANSITION_LABELS] ?? a.to}
              </Button>
            ))}
          </SheetFooter>
        )}
      </SheetContent>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          {dialog && (
            <form
              className="grid gap-4"
              action={(fd) => run(dialog.to, (fd.get("comment") as string) ?? "", dialog.to === "PENDING" ? fd : undefined)}
            >
              <DialogHeader>
                <DialogTitle>{TRANSITION_LABELS[dialog.to as keyof typeof TRANSITION_LABELS]}</DialogTitle>
                <DialogDescription>
                  {dialog.to === "REJECTED" && "반려 사유를 입력해 주세요. 수강생에게 표시됩니다."}
                  {dialog.to === "NEEDS_REVISION" && "보완이 필요한 내용을 입력해 주세요."}
                  {dialog.to === "CANCELED" && "접수를 취소하면 되돌릴 수 없습니다."}
                  {dialog.to === "PENDING" && "보완한 내용을 적고 다시 제출합니다."}
                </DialogDescription>
              </DialogHeader>
              {dialog.to !== "CANCELED" && (
                <div className="space-y-1.5">
                  <Label htmlFor="t-comment">{dialog.commentRequired ? "사유 (필수)" : "메모 (선택)"}</Label>
                  <Textarea
                    id="t-comment"
                    name="comment"
                    required={dialog.commentRequired}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    maxLength={2000}
                  />
                </div>
              )}
              {dialog.to === "PENDING" && detail?.type === "ABSENCE" && (
                <div className="space-y-1.5">
                  <Label htmlFor="t-files">증빙 추가 (선택, 최대 3개)</Label>
                  <input
                    id="t-files"
                    name="files"
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/heic,image/heif,.heic,application/pdf"
                    className="block w-full text-sm text-neutral-600 file:mr-3 file:h-9 file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:text-sm"
                  />
                </div>
              )}
              {actionError && <Alert tone="danger">{actionError}</Alert>}
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialog(null)}>
                  닫기
                </Button>
                <Button
                  type="submit"
                  variant={dialog.to === "REJECTED" || dialog.to === "CANCELED" ? "destructive" : "default"}
                  disabled={pending || (dialog.commentRequired && !comment.trim())}
                >
                  {pending ? "처리 중…" : TRANSITION_LABELS[dialog.to as keyof typeof TRANSITION_LABELS]}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <ProofDialog cohortId={cohortId} ticketId={proofOpen && detail ? detail.id : null} onClose={() => setProofOpen(false)} />
    </Sheet>
  );
}
