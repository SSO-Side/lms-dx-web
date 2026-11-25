// 서류 내용 보기·첨삭 코멘트 목록 컴포넌트(수강생·강사·면접 화면 공용).
import { MessageSquareText } from "lucide-react";
import type { DocumentType } from "@prisma/client";
import type { ReviewNoteRow } from "@/server/document-queries";
import { RESUME_FIELDS, type DocumentContent } from "@/lib/documents/forms";

/** 저장된 서류 내용을 읽기 전용으로 보여 준다 (이력서는 항목별, 자소서는 통으로). */
export function DocumentContentView({ type, content }: { type: DocumentType; content: DocumentContent | null }) {
  if (!content) {
    return <p className="rounded-lg bg-neutral-50 px-3 py-3 text-sm text-neutral-500">아직 저장한 내용이 없습니다.</p>;
  }
  const sections =
    type === "COVER_LETTER"
      ? [{ label: "자기소개서", text: content.body ?? "" }]
      : RESUME_FIELDS.map((f) => ({ label: f.label, text: content[f.key] ?? "" }));
  return (
    <div className="space-y-3">
      {sections.map((sec) => (
        <section key={sec.label} className="rounded-lg border border-neutral-200 p-3">
          <h4 className="text-xs font-semibold text-neutral-500">{sec.label}</h4>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-neutral-800">{sec.text.trim() || "—"}</p>
        </section>
      ))}
    </div>
  );
}

/** 강사 첨삭 코멘트 목록 */
export function ReviewNoteList({ notes }: { notes: ReviewNoteRow[] }) {
  if (notes.length === 0) {
    return <p className="rounded-lg bg-neutral-50 px-3 py-3 text-sm text-neutral-500">아직 강사 코멘트가 없습니다.</p>;
  }
  return (
    <ol className="space-y-2">
      {notes.map((n) => (
        <li key={n.id} className="rounded-lg border border-neutral-200 p-3 text-sm">
          <p className="flex items-center gap-1.5 text-xs text-neutral-500">
            <MessageSquareText className="size-3.5" aria-hidden />
            <span className="font-medium text-neutral-700">{n.reviewerName}</span>
            <span className="tabular-nums">{n.createdAt}</span>
          </p>
          <p className="mt-1.5 whitespace-pre-wrap text-neutral-800">{n.comment}</p>
        </li>
      ))}
    </ol>
  );
}
