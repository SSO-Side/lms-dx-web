"use client";

// 챗봇 매뉴얼 관리(클라이언트): PDF 등록 폼, 목록, 삭제 확인. 반 문서 화면과 학원 문서 화면이 함께 쓴다.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, RefreshCw, Trash2 } from "lucide-react";
import { uploadChatDocAction, deleteChatDocAction, uploadAcademyChatDocAction, deleteAcademyChatDocAction } from "@/server/chatbot";
import type { ChatDocItem } from "@/server/chatbot-queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Widget } from "@/components/Widget";
import { StatusBadge } from "@/components/StatusBadge";
import { CHAT_DOC_TITLE_MAX } from "@/lib/ai/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const AUDIENCE_LABELS = { ALL: "전체", STUDENT: "수강생", INSTRUCTOR: "교직원" } as const;
const selectCls = "h-10 w-full rounded-md border border-neutral-300 bg-card px-3 text-sm text-neutral-900";

/** 문서 한 건: 제목(파일 열기), 대상·상태·크기. action은 삭제 버튼 같은 행 동작 */
function DocRow({ doc: d, fileHref, action }: { doc: ChatDocItem; fileHref: string; action?: React.ReactNode }) {
  return (
    <li className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <a href={fileHref} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm font-medium text-primary-500 hover:underline">
          <FileText className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{d.title}</span>
        </a>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
          <Badge variant="outline">{AUDIENCE_LABELS[d.audience]}</Badge>
          <StatusBadge domain="chatDoc" value={d.status} />
          {d.sizeLabel} · {d.dateLabel} · {d.uploaderName}
        </p>
        {d.status === "FAILED" && <p className="mt-1 text-xs text-status-danger-fg">{d.error ?? "문서를 처리하지 못했습니다."} 삭제한 뒤 다시 등록해 주세요.</p>}
        {d.status === "UNSYNCED" && <p className="mt-1 text-xs text-neutral-500">챗봇에 전달되지 않은 문서입니다. 삭제한 뒤 다시 등록해 주세요.</p>}
      </div>
      {action}
    </li>
  );
}

/** 반 화면에서 보여 주는 학원 공통 문서 목록(읽기 전용). 파일은 반 경로로 연다. */
export function SharedChatDocs({ cohortId, docs, manageLink }: { cohortId: number; docs: ChatDocItem[]; manageLink?: React.ReactNode }) {
  return (
    <Widget
      title="학원 문서 (모든 반 공통)"
      subtitle="이 반 챗봇도 근거로 씁니다. 등록·삭제는 학원 관리자가 학원 문서 화면에서 합니다."
      action={manageLink}
      empty={docs.length === 0 ? { message: "아직 등록된 학원 문서가 없습니다." } : false}
    >
      <ul className="divide-y divide-neutral-200">
        {docs.map((d) => (
          <DocRow key={d.id} doc={d} fileHref={`/api/c/${cohortId}/chatbot-docs/${d.id}/file`} />
        ))}
      </ul>
    </Widget>
  );
}

/** 문서 등록·삭제 화면. cohortId가 null이면 학원 공통 문서를 관리한다. */
export function ChatDocsManager({ cohortId, docs }: { cohortId: number | null; docs: ChatDocItem[] }) {
  const router = useRouter();
  const isAcademy = cohortId === null;
  const fileHref = (id: number) => (isAcademy ? `/api/academy/chatbot-docs/${id}/file` : `/api/c/${cohortId}/chatbot-docs/${id}/file`);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [target, setTarget] = useState<ChatDocItem | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setError(null);
    setSaved(null);
    startTransition(async () => {
      const res = cohortId === null ? await uploadAcademyChatDocAction(fd) : await uploadChatDocAction(cohortId, fd);
      if (!res.ok) return setError(res.error);
      form.reset();
      setSaved(res.status === "PROCESSING" ? "문서를 등록했습니다. 챗봇이 처리 중이라 잠시 후부터 답변에 쓰입니다." : "문서를 등록했습니다.");
      router.refresh();
    });
  };

  const remove = () => {
    if (!target) return;
    startTransition(async () => {
      const res = cohortId === null ? await deleteAcademyChatDocAction(target.id) : await deleteChatDocAction(cohortId, target.id);
      if (!res.ok) setError(res.error);
      else setSaved("문서를 삭제했습니다.");
      setTarget(null);
      router.refresh();
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {saved && <Alert tone="success" className="lg:col-span-2">{saved}</Alert>}
      {error && <Alert tone="danger" className="lg:col-span-2">{error}</Alert>}

      <Widget title="매뉴얼 PDF 등록" subtitle={`${isAcademy ? "모든 반의 챗봇이" : "이 반 챗봇이"} 답변 근거로 쓰는 문서입니다. PDF만, 10MB 이하.`}>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cd-title">문서 제목</Label>
            <Input id="cd-title" name="title" required maxLength={CHAT_DOC_TITLE_MAX} placeholder="예: 운영 매뉴얼" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cd-file">PDF 파일</Label>
            <Input id="cd-file" name="file" type="file" accept=".pdf,application/pdf" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cd-audience">열람 대상</Label>
            <select id="cd-audience" name="audience" defaultValue="ALL" className={selectCls}>
              <option value="ALL">전체</option>
              <option value="STUDENT">수강생</option>
              <option value="INSTRUCTOR">교직원(강사·매니저·관리자)</option>
            </select>
          </div>
          <Button type="submit" disabled={pending} className="cursor-pointer">
            {pending ? "등록 중…" : "등록"}
          </Button>
        </form>
      </Widget>

      <Widget title={isAcademy ? "등록된 학원 문서" : "이 반 문서"} subtitle={`${docs.length}개`} empty={docs.length === 0 ? { message: "아직 등록된 매뉴얼이 없습니다. 왼쪽에서 PDF를 등록해 주세요." } : false}>
        {docs.some((d) => d.status === "PROCESSING") && (
          <Button variant="outline" size="sm" onClick={() => router.refresh()} className="mb-2 cursor-pointer">
            <RefreshCw />
            상태 새로고침
          </Button>
        )}
        <ul className="divide-y divide-neutral-200">
          {docs.map((d) => (
            <DocRow
              key={d.id}
              doc={d}
              fileHref={fileHref(d.id)}
              action={
                <Button variant="destructive-outline" size="sm" onClick={() => setTarget(d)} aria-label={`${d.title} 삭제`} className="cursor-pointer">
                  <Trash2 />
                  삭제
                </Button>
              }
            />
          ))}
        </ul>
      </Widget>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>문서를 삭제할까요?</DialogTitle>
            <DialogDescription>「{target?.title}」을 삭제하면 챗봇이 더 이상 이 문서를 근거로 쓰지 않으며 되돌릴 수 없습니다.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} className="cursor-pointer">취소</Button>
            <Button variant="destructive" onClick={remove} disabled={pending} className="cursor-pointer">삭제</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
