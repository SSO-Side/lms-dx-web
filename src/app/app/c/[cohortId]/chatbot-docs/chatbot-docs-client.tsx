"use client";

// 챗봇 매뉴얼 관리(클라이언트): PDF 등록 폼, 목록, 삭제 확인.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Trash2 } from "lucide-react";
import { uploadChatDocAction, deleteChatDocAction } from "@/server/chatbot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Widget } from "@/components/Widget";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const AUDIENCE_LABELS = { ALL: "전체", STUDENT: "수강생", INSTRUCTOR: "교직원" } as const;
const selectCls = "h-10 w-full rounded-md border border-neutral-300 bg-card px-3 text-sm text-neutral-900";

export interface ChatDocItem {
  id: number;
  title: string;
  audience: keyof typeof AUDIENCE_LABELS;
  isAcademyWide: boolean;
  fileName: string;
  sizeLabel: string;
  dateLabel: string;
  uploaderName: string;
  canDelete: boolean;
}

export function ChatbotDocsClient({ cohortId, docs, canAcademyWide }: { cohortId: number; docs: ChatDocItem[]; canAcademyWide: boolean }) {
  const router = useRouter();
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
      const res = await uploadChatDocAction(cohortId, fd);
      if (!res.ok) return setError(res.error);
      form.reset();
      setSaved("문서를 등록했습니다.");
      router.refresh();
    });
  };

  const remove = () => {
    if (!target) return;
    startTransition(async () => {
      const res = await deleteChatDocAction(cohortId, target.id);
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

      <Widget title="매뉴얼 PDF 등록" subtitle="챗봇이 답변 근거로 쓰는 문서입니다. PDF만, 10MB 이하.">
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cd-title">문서 제목</Label>
            <Input id="cd-title" name="title" required maxLength={200} placeholder="예: 운영 매뉴얼" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cd-file">PDF 파일</Label>
            <Input id="cd-file" name="file" type="file" accept=".pdf,application/pdf" required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cd-audience">열람 대상</Label>
              <select id="cd-audience" name="audience" defaultValue="ALL" className={selectCls}>
                <option value="ALL">전체</option>
                <option value="STUDENT">수강생</option>
                <option value="INSTRUCTOR">교직원(강사·매니저·관리자)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cd-scope">적용 범위</Label>
              <select id="cd-scope" name="scope" defaultValue="COHORT" className={selectCls}>
                <option value="COHORT">이 반만</option>
                {canAcademyWide && <option value="ACADEMY">학원 전체</option>}
              </select>
            </div>
          </div>
          <Button type="submit" disabled={pending} className="cursor-pointer">
            {pending ? "등록 중…" : "등록"}
          </Button>
        </form>
      </Widget>

      <Widget title="등록된 문서" subtitle={`${docs.length}개`} empty={docs.length === 0 ? { message: "아직 등록된 매뉴얼이 없습니다. 왼쪽에서 PDF를 등록해 주세요." } : false}>
        <ul className="divide-y divide-neutral-200">
          {docs.map((d) => (
            <li key={d.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <a href={`/api/c/${cohortId}/chatbot-docs/${d.id}/file`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm font-medium text-primary-500 hover:underline">
                  <FileText className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{d.title}</span>
                </a>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
                  <Badge>{d.isAcademyWide ? "학원 전체" : "이 반"}</Badge>
                  <Badge variant="outline">{AUDIENCE_LABELS[d.audience]}</Badge>
                  {d.sizeLabel} · {d.dateLabel} · {d.uploaderName}
                </p>
              </div>
              {d.canDelete && (
                <Button variant="destructive-outline" size="sm" onClick={() => setTarget(d)} aria-label={`${d.title} 삭제`} className="cursor-pointer">
                  <Trash2 />
                  삭제
                </Button>
              )}
            </li>
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
