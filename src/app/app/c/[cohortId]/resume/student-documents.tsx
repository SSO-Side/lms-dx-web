"use client";

// 서류 > 내 서류(수강생): 서류 추가, 새 버전 업로드, 첨삭 요청.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, FilePlus2, Send, Upload } from "lucide-react";
import type { DocumentType } from "@prisma/client";
import { createDocumentAction, uploadVersionAction, requestReviewAction } from "@/server/documents";
import type { DocumentDetail } from "@/server/document-queries";
import { DOCUMENT_TYPE_LABELS, AI_CONSENT_TEXT } from "@/lib/documents/labels";
import { availableDocumentTransitions } from "@/lib/documents/transitions";
import { StatusBadge } from "@/components/StatusBadge";
import { StageSteps } from "@/components/documents/StageSteps";
import { VersionList, ReviewNoteList } from "@/components/documents/DocumentHistory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter } from "@/components/ui/sheet";

const MAX_BYTES = 10 * 1024 * 1024;

export function StudentDocuments({ cohortId, documents }: { cohortId: number; documents: DocumentDetail[] }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [upload, setUpload] = useState<{ documentId: number | null } | null>(null);
  const open = documents.find((d) => d.id === openId) ?? null;

  return (
    <div className="space-y-4">
      <Button size="lg" className="w-full sm:w-auto" onClick={() => setUpload({ documentId: null })}>
        <FilePlus2 /> 서류 추가
      </Button>

      {documents.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-card px-4 py-10 text-center">
          <p className="text-sm text-neutral-500">아직 올린 서류가 없습니다.</p>
          <Button variant="link" className="mt-2" onClick={() => setUpload({ documentId: null })}>
            이력서 올리기
          </Button>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {documents.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => setOpenId(d.id)}
                className="flex w-full flex-col gap-3 rounded-xl border border-neutral-200 bg-card p-4 text-left hover:border-primary-300 hover:bg-neutral-50"
              >
                <div className="flex w-full items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-neutral-500">{DOCUMENT_TYPE_LABELS[d.type]}</p>
                    <p className="truncate font-semibold text-neutral-900">{d.title}</p>
                  </div>
                  <StatusBadge domain="document" value={d.status} />
                  <ChevronRight className="mt-0.5 size-4 shrink-0 text-neutral-400" aria-hidden />
                </div>
                <StageSteps status={d.status} className="w-full" />
                <p className="text-xs text-neutral-500 tabular-nums">
                  최근 수정 {d.updatedAt} · 버전 {d.versions.length}개{d.notes.length > 0 ? ` · 코멘트 ${d.notes.length}개` : ""}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      <DocumentSheet
        cohortId={cohortId}
        doc={open}
        onClose={() => setOpenId(null)}
        onUpload={(id) => setUpload({ documentId: id })}
      />
      <UploadSheet
        cohortId={cohortId}
        target={upload}
        targetDoc={upload?.documentId ? documents.find((d) => d.id === upload.documentId) ?? null : null}
        onClose={() => setUpload(null)}
        onDone={(id) => {
          setUpload(null);
          setOpenId(id);
        }}
      />
    </div>
  );
}

/** 서류 상세: 단계, 버전 이력, 강사 코멘트, 하단 고정 버튼(새 버전 / 첨삭 요청) */
function DocumentSheet({
  cohortId,
  doc,
  onClose,
  onUpload,
}: {
  cohortId: number;
  doc: DocumentDetail | null;
  onClose: () => void;
  onUpload: (id: number) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // 화면 버튼은 전이표에서 계산 (서버에서도 같은 표로 다시 검사)
  const canRequest = !!doc && availableDocumentTransitions(doc.status, "STUDENT", true).some((r) => r.to === "IN_REVIEW") && doc.versions.length > 0;

  const request = () => {
    if (!doc) return;
    setError(null);
    startTransition(async () => {
      const res = await requestReviewAction(cohortId, doc.id);
      if (!res.ok) return setError(res.error);
      router.refresh();
    });
  };

  return (
    <Sheet
      open={doc !== null}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setError(null);
        }
      }}
    >
      <SheetContent>
        {doc && (
          <>
            <SheetHeader>
              <SheetTitle>{doc.title}</SheetTitle>
              <SheetDescription render={<div />} className="flex flex-wrap items-center gap-2">
                <StatusBadge domain="document" value={doc.status} />
                <span>
                  {DOCUMENT_TYPE_LABELS[doc.type]} · 최근 수정 {doc.updatedAt}
                </span>
              </SheetDescription>
            </SheetHeader>
            <SheetBody className="space-y-5">
              <StageSteps status={doc.status} />
              {doc.status === "DRAFT" && doc.notes.length > 0 && (
                <Alert tone="warning">강사 코멘트를 확인하고 새 버전을 올린 뒤 다시 첨삭을 요청하세요.</Alert>
              )}
              {doc.status === "IN_REVIEW" && <Alert tone="info">강사가 첨삭 중입니다. 새 버전을 올리면 초안으로 돌아갑니다.</Alert>}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-neutral-900">강사 코멘트</h3>
                <ReviewNoteList notes={doc.notes} />
              </section>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-neutral-900">버전 이력</h3>
                <VersionList cohortId={cohortId} versions={doc.versions} />
              </section>
              {error && <Alert tone="danger">{error}</Alert>}
            </SheetBody>
            <SheetFooter>
              <Button size="lg" variant="outline" onClick={() => onUpload(doc.id)} disabled={pending}>
                <Upload /> 새 버전 올리기
              </Button>
              <Button size="lg" onClick={request} disabled={pending || !canRequest} title={doc.versions.length === 0 ? "파일을 먼저 올려 주세요" : undefined}>
                <Send /> {pending ? "요청하는 중…" : "첨삭 요청"}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** 서류 추가(제목·유형·파일) / 새 버전(파일만). PDF 10MB 이하, AI 활용 동의 필수. 최종 검사는 서버에서 한다. */
function UploadSheet({
  cohortId,
  target,
  targetDoc,
  onClose,
  onDone,
}: {
  cohortId: number;
  target: { documentId: number | null } | null;
  targetDoc: DocumentDetail | null;
  onClose: () => void;
  onDone: (id: number) => void;
}) {
  const router = useRouter();
  const isNew = target?.documentId === null;
  const [title, setTitle] = useState("");
  const [type, setType] = useState<DocumentType>("RESUME");
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setTitle("");
    setType("RESUME");
    setFile(null);
    setConsent(false);
    setError(null);
  };

  const submit = () => {
    setError(null);
    if (isNew && !title.trim()) return setError("제목을 입력해 주세요.");
    if (!file) return setError("PDF 파일을 선택해 주세요.");
    if (!file.name.toLowerCase().endsWith(".pdf")) return setError("PDF 파일(.pdf)만 올릴 수 있습니다.");
    if (file.size > MAX_BYTES) return setError("파일은 10MB 이하만 올릴 수 있습니다.");
    if (!consent) return setError("AI 활용 안내에 동의해야 올릴 수 있습니다.");

    const fd = new FormData();
    fd.set("file", file);
    fd.set("aiConsent", "on");
    if (isNew) {
      fd.set("title", title);
      fd.set("type", type);
    }
    startTransition(async () => {
      const res = isNew ? await createDocumentAction(cohortId, fd) : await uploadVersionAction(cohortId, target!.documentId!, fd);
      if (!res.ok) return setError(res.error);
      reset();
      router.refresh();
      if (res.documentId) onDone(res.documentId);
    });
  };

  return (
    <Sheet
      open={target !== null}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          reset();
        }
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isNew ? "서류 추가" : "새 버전 올리기"}</SheetTitle>
          <SheetDescription>
            {isNew ? "이력서·자기소개서·포트폴리오를 PDF로 올립니다." : `${targetDoc?.title ?? ""} · 올리면 상태가 초안으로 돌아갑니다.`}
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-4">
          {isNew && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="doc-type">유형</Label>
                <select
                  id="doc-type"
                  value={type}
                  onChange={(e) => setType(e.target.value as DocumentType)}
                  className="h-12 w-full rounded-md border border-neutral-300 bg-card px-3 text-base"
                >
                  {(Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]).map((t) => (
                    <option key={t} value={t}>
                      {DOCUMENT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doc-title">제목</Label>
                <Input
                  id="doc-title"
                  className="h-12 text-base"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  placeholder="예: 백엔드 개발자 지원 이력서"
                />
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="doc-file">PDF 파일</Label>
            <input
              id="doc-file"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-neutral-600 file:mr-3 file:h-11 file:rounded-md file:border-0 file:bg-primary-50 file:px-4 file:text-sm file:font-medium file:text-primary-700"
            />
            <p className="text-xs text-neutral-500">PDF만 · 10MB 이하</p>
            {file && (
              <p className="flex justify-between gap-2 text-sm text-neutral-700">
                <span className="truncate">{file.name}</span>
                <span className="shrink-0 text-neutral-500 tabular-nums">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
              </p>
            )}
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-200 p-3 text-sm text-neutral-800">
            <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary-500" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              <span className="font-medium">(필수)</span> {AI_CONSENT_TEXT}
            </span>
          </label>
          {error && <Alert tone="danger">{error}</Alert>}
        </SheetBody>
        <SheetFooter>
          <Button size="lg" variant="outline" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button size="lg" onClick={submit} disabled={pending || !consent}>
            <Upload /> {pending ? "올리는 중…" : "올리기"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
