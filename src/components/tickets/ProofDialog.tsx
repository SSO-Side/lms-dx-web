"use client";

import { useEffect, useState } from "react";
import { FileText, Download } from "lucide-react";
import { listProofsAction } from "@/server/tickets";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/alert";

type Att = { id: number; originalName: string; mimeType: string; size: number };

export const proofUrl = (cohortId: number, attachmentId: number) => `/api/c/${cohortId}/attachments/${attachmentId}`;
export const isPreviewable = (mime: string) => mime === "image/jpeg" || mime === "image/png";

/** 증빙 확인 모달 (드로어 위). ticketId가 null이면 닫힘. */
export function ProofDialog({ cohortId, ticketId, onClose }: { cohortId: number; ticketId: number | null; onClose: () => void }) {
  const [atts, setAtts] = useState<Att[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ticketId === null) return;
    let alive = true;
    setAtts(null);
    setError(null);
    listProofsAction(cohortId, ticketId).then((res) => {
      if (!alive) return;
      if (res.ok) setAtts(res.attachments);
      else setError(res.error);
    });
    return () => {
      alive = false;
    };
  }, [cohortId, ticketId]);

  return (
    <Dialog open={ticketId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>증빙 · 결석계 #{ticketId}</DialogTitle>
          <DialogDescription>권한이 있는 사용자에게만 표시됩니다. 외부로 공유하지 마세요.</DialogDescription>
        </DialogHeader>
        {error && <Alert tone="danger">{error}</Alert>}
        {!error && atts === null && <div className="h-48 animate-pulse rounded-lg bg-neutral-100" aria-busy="true" />}
        {atts && atts.length === 0 && <p className="py-6 text-center text-sm text-neutral-500">첨부된 증빙이 없습니다.</p>}
        {atts && atts.length > 0 && <ProofList cohortId={cohortId} attachments={atts} large />}
      </DialogContent>
    </Dialog>
  );
}

export function ProofList({ cohortId, attachments, large = false }: { cohortId: number; attachments: Att[]; large?: boolean }) {
  return (
    <ul className={large ? "max-h-[70dvh] space-y-3 overflow-y-auto" : "grid grid-cols-3 gap-2"}>
      {attachments.map((a) => (
        <li key={a.id} className="overflow-hidden rounded-lg border border-neutral-200">
          {isPreviewable(a.mimeType) ? (
            <a href={proofUrl(cohortId, a.id)} target="_blank" rel="noreferrer" title={a.originalName}>
              {/* eslint-disable-next-line @next/next/no-img-element -- 권한 확인 후 서버가 전달하는 비공개 파일 */}
              <img src={proofUrl(cohortId, a.id)} alt={a.originalName} className={large ? "w-full object-contain" : "aspect-square w-full object-cover"} />
            </a>
          ) : (
            <a
              href={proofUrl(cohortId, a.id)}
              target="_blank"
              rel="noreferrer"
              className="flex aspect-square flex-col items-center justify-center gap-1 p-2 text-center text-xs text-neutral-600 hover:bg-neutral-50"
            >
              <FileText className="size-6 text-neutral-400" aria-hidden />
              <span className="line-clamp-2 break-all">{a.originalName}</span>
              <Download className="size-3.5" aria-hidden />
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
