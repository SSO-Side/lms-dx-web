import { ExternalLink, FileText, MessageSquareText, ShieldCheck } from "lucide-react";
import type { DocumentVersionRow, ReviewNoteRow } from "@/server/document-queries";

/** 서류 PDF는 권한 확인 라우트로만 연다 (직접 URL 없음). 브라우저 기본 PDF 뷰어로 새 탭에서 열린다. */
export function documentFileHref(cohortId: number, versionId: number) {
  return `/api/c/${cohortId}/documents/versions/${versionId}`;
}

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

export function VersionList({ cohortId, versions }: { cohortId: number; versions: DocumentVersionRow[] }) {
  if (versions.length === 0) {
    return <p className="rounded-lg bg-neutral-50 px-3 py-3 text-sm text-neutral-500">아직 올린 파일이 없습니다.</p>;
  }
  return (
    <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
      {versions.map((v, i) => (
        <li key={v.id}>
          <a
            href={documentFileHref(cohortId, v.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-12 items-center gap-3 px-3 py-2 hover:bg-neutral-50"
          >
            <FileText className="size-5 shrink-0 text-neutral-400" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-medium text-neutral-900">
                v{v.versionNo}
                {i === 0 && <span className="rounded-full bg-primary-50 px-1.5 text-xs font-medium text-primary-700">최신</span>}
                <span className="truncate font-normal text-neutral-600">{v.fileName}</span>
              </p>
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-neutral-500 tabular-nums">
                {v.createdAt} · {formatSize(v.size)}
                {v.aiConsent && (
                  <span className="inline-flex items-center gap-0.5">
                    <ShieldCheck className="size-3" aria-hidden /> AI 활용 동의
                  </span>
                )}
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-sm text-primary-500">
              열기 <ExternalLink className="size-3.5" aria-hidden />
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

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
