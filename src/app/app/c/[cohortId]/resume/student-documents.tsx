"use client";

// 서류 > 내 서류(수강생): 이력서·자기소개서 입력 양식 저장(유형당 1개), 내용 보기, 첨삭 요청.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Pencil, Send } from "lucide-react";
import { saveDocumentAction, requestReviewAction } from "@/server/documents";
import type { DocumentDetail } from "@/server/document-queries";
import { DOCUMENT_TYPE_LABELS, AI_CONSENT_TEXT } from "@/lib/documents/labels";
import {
  FORM_DOCUMENT_TYPES,
  RESUME_FIELDS,
  COVER_LETTER_MAX_LENGTH,
  COVER_LETTER_TEMPLATE,
  emptyResumeContent,
  type FormDocumentType,
} from "@/lib/documents/forms";
import { availableDocumentTransitions } from "@/lib/documents/transitions";
import { StatusBadge } from "@/components/StatusBadge";
import { StageSteps } from "@/components/documents/StageSteps";
import { DocumentContentView, ReviewNoteList } from "@/components/documents/DocumentHistory";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter } from "@/components/ui/sheet";

export function StudentDocuments({ cohortId, documents }: { cohortId: number; documents: DocumentDetail[] }) {
  const [viewType, setViewType] = useState<FormDocumentType | null>(null);
  const [editType, setEditType] = useState<FormDocumentType | null>(null);
  const byType = (t: FormDocumentType) => documents.find((d) => d.type === t) ?? null;
  const viewing = viewType ? byType(viewType) : null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">이력서와 자기소개서는 각각 1개만 저장할 수 있습니다. 저장한 내용은 면접 화면에서 불러옵니다.</p>
      <ul className="grid gap-3 md:grid-cols-2">
        {FORM_DOCUMENT_TYPES.map((t) => {
          const d = byType(t);
          return (
            <li key={t} className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-card p-4">
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 font-semibold text-neutral-900">{DOCUMENT_TYPE_LABELS[t]}</p>
                {d ? <StatusBadge domain="document" value={d.status} /> : <StatusBadge domain="document" value="NONE" />}
              </div>
              {d ? (
                <>
                  <StageSteps status={d.status} className="w-full" />
                  <p className="text-xs text-neutral-500 tabular-nums">
                    최근 수정 {d.updatedAt}
                    {d.notes.length > 0 ? ` · 코멘트 ${d.notes.length}개` : ""}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setViewType(t)}>
                      보기 <ChevronRight />
                    </Button>
                    <Button className="flex-1" onClick={() => setEditType(t)}>
                      <Pencil /> 수정
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-neutral-500">아직 작성하지 않았습니다.</p>
                  <Button onClick={() => setEditType(t)}>
                    <Pencil /> 작성하기
                  </Button>
                </>
              )}
            </li>
          );
        })}
      </ul>

      <DocumentSheet cohortId={cohortId} doc={viewing} onClose={() => setViewType(null)} onEdit={(t) => setEditType(t)} />
      <EditSheet
        cohortId={cohortId}
        type={editType}
        doc={editType ? byType(editType) : null}
        onClose={() => setEditType(null)}
        onDone={(t) => {
          setEditType(null);
          setViewType(t);
        }}
      />
    </div>
  );
}

/** 서류 상세: 단계, 작성 내용, 강사 코멘트, 하단 고정 버튼(수정 / 첨삭 요청) */
function DocumentSheet({
  cohortId,
  doc,
  onClose,
  onEdit,
}: {
  cohortId: number;
  doc: DocumentDetail | null;
  onClose: () => void;
  onEdit: (t: FormDocumentType) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // 화면 버튼은 전이표에서 계산 (서버에서도 같은 표로 다시 검사)
  const canRequest = !!doc && doc.content !== null && availableDocumentTransitions(doc.status, "STUDENT", true).some((r) => r.to === "IN_REVIEW");

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
              <SheetTitle>{DOCUMENT_TYPE_LABELS[doc.type]}</SheetTitle>
              <SheetDescription render={<div />} className="flex flex-wrap items-center gap-2">
                <StatusBadge domain="document" value={doc.status} />
                <span>최근 수정 {doc.updatedAt}</span>
              </SheetDescription>
            </SheetHeader>
            <SheetBody className="space-y-5">
              <StageSteps status={doc.status} />
              {doc.status === "DRAFT" && doc.notes.length > 0 && <Alert tone="warning">강사 코멘트를 확인해 내용을 고친 뒤 다시 첨삭을 요청하세요.</Alert>}
              {doc.status === "IN_REVIEW" && <Alert tone="info">강사가 첨삭 중입니다. 내용을 고치면 초안으로 돌아갑니다.</Alert>}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-neutral-900">작성 내용</h3>
                <DocumentContentView type={doc.type} content={doc.content} />
              </section>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-neutral-900">강사 코멘트</h3>
                <ReviewNoteList notes={doc.notes} />
              </section>
              {error && <Alert tone="danger">{error}</Alert>}
            </SheetBody>
            <SheetFooter>
              <Button size="lg" variant="outline" onClick={() => isForm(doc.type) && onEdit(doc.type)} disabled={pending}>
                <Pencil /> 수정
              </Button>
              <Button size="lg" onClick={request} disabled={pending || !canRequest}>
                <Send /> {pending ? "요청하는 중…" : "첨삭 요청"}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function isForm(t: string): t is FormDocumentType {
  return t === "RESUME" || t === "COVER_LETTER";
}

/** 입력 양식: 이력서는 7항목, 자기소개서는 한 칸(4,000자). 최종 검증은 서버에서 한다. */
function EditSheet({
  cohortId,
  type,
  doc,
  onClose,
  onDone,
}: {
  cohortId: number;
  type: FormDocumentType | null;
  doc: DocumentDetail | null;
  onClose: () => void;
  onDone: (t: FormDocumentType) => void;
}) {
  // type·doc이 바뀔 때마다 새로 마운트해 초기값을 다시 잡는다
  return (
    <Sheet open={type !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        {type && <EditForm key={`${type}-${doc?.updatedAt ?? "new"}`} cohortId={cohortId} type={type} doc={doc} onClose={onClose} onDone={onDone} />}
      </SheetContent>
    </Sheet>
  );
}

function EditForm({
  cohortId,
  type,
  doc,
  onClose,
  onDone,
}: {
  cohortId: number;
  type: FormDocumentType;
  doc: DocumentDetail | null;
  onClose: () => void;
  onDone: (t: FormDocumentType) => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() => {
    if (type === "COVER_LETTER") return { body: doc?.content?.body ?? COVER_LETTER_TEMPLATE };
    return { ...emptyResumeContent(), ...(doc?.content ?? {}) };
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));

  const save = () => {
    setError(null);
    if (type === "COVER_LETTER" && (values.body ?? "").length > COVER_LETTER_MAX_LENGTH) {
      return setError(`자기소개서는 ${COVER_LETTER_MAX_LENGTH.toLocaleString()}자 이내로 입력해 주세요.`);
    }
    startTransition(async () => {
      const res = await saveDocumentAction(cohortId, type, values);
      if (!res.ok) return setError(res.error);
      router.refresh();
      onDone(type);
    });
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle>{DOCUMENT_TYPE_LABELS[type]} {doc ? "수정" : "작성"}</SheetTitle>
        <SheetDescription>{doc ? "저장하면 상태가 초안으로 돌아갑니다." : "기본 양식에 맞춰 작성합니다."}</SheetDescription>
      </SheetHeader>
      <SheetBody className="space-y-4">
        {type === "RESUME" ? (
          RESUME_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`f-${f.key}`}>{f.label}</Label>
              <Textarea
                id={`f-${f.key}`}
                rows={f.rows}
                maxLength={f.maxLength}
                value={values[f.key] ?? ""}
                placeholder={f.placeholder}
                onChange={(e) => set(f.key, e.target.value)}
                className="text-base"
              />
            </div>
          ))
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="f-body">자기소개서</Label>
            <Textarea
              id="f-body"
              rows={18}
              value={values.body ?? ""}
              onChange={(e) => set("body", e.target.value)}
              className="text-base"
              aria-describedby="f-body-count"
            />
            <p id="f-body-count" className={`text-right text-xs tabular-nums ${(values.body ?? "").length > COVER_LETTER_MAX_LENGTH ? "text-status-danger-solid" : "text-neutral-500"}`}>
              {(values.body ?? "").length.toLocaleString()} / {COVER_LETTER_MAX_LENGTH.toLocaleString()}자
            </p>
          </div>
        )}
        <p className="text-xs text-neutral-500">{AI_CONSENT_TEXT}</p>
        {error && <Alert tone="danger">{error}</Alert>}
      </SheetBody>
      <SheetFooter>
        <Button size="lg" variant="outline" onClick={onClose} disabled={pending}>
          취소
        </Button>
        <Button size="lg" onClick={save} disabled={pending}>
          {pending ? "저장하는 중…" : "저장"}
        </Button>
      </SheetFooter>
    </>
  );
}
