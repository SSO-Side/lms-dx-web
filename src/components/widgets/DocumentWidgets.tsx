// 홈 위젯: 서류 진행(수강생 내 서류, 교직원 단계별 현황).
import Link from "next/link";
import type { DocumentStatus, DocumentType } from "@prisma/client";
import { ChevronRight, FilePlus2 } from "lucide-react";
import { Widget } from "@/components/Widget";
import { StatusBadge } from "@/components/StatusBadge";
import { StageSteps } from "@/components/documents/StageSteps";
import { buttonVariants } from "@/components/ui/button";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents/labels";
import type { StageCounts } from "@/lib/documents/summary";

const TYPES: DocumentType[] = ["RESUME", "COVER_LETTER", "PORTFOLIO"];

/** 수강생 홈: 내 서류 — 유형별 최신 서류의 단계 진행 */
export function MyDocumentsWidget({
  cohortId,
  documents,
}: {
  cohortId: number;
  documents: Array<{ type: DocumentType; status: DocumentStatus; title: string }>;
}) {
  const href = `/app/c/${cohortId}/resume`;
  // documents는 최근 수정 순 → 유형별 첫 항목이 최신
  const latest = TYPES.map((t) => ({ type: t, doc: documents.find((d) => d.type === t) ?? null }));
  const registered = latest.filter((l) => l.doc).length;

  return (
    <Widget
      title="내 서류"
      subtitle={`${registered}/${TYPES.length}종 등록`}
      density="comfortable"
      empty={documents.length === 0 ? { message: "아직 올린 서류가 없습니다.", action: <Link href={href} className={buttonVariants({ size: "sm" })}><FilePlus2 aria-hidden /> 이력서 올리기</Link> } : undefined}
    >
      <ul className="space-y-4">
        {latest.map(({ type, doc }) => (
          <li key={type}>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-sm">
                <span className="font-medium text-neutral-900">{DOCUMENT_TYPE_LABELS[type]}</span>
                {doc && <span className="ml-1.5 text-neutral-500">{doc.title}</span>}
              </p>
              <StatusBadge domain="document" value={doc?.status ?? "NONE"} />
            </div>
            <StageSteps status={doc?.status ?? null} />
          </li>
        ))}
      </ul>
      <Link href={href} className="mt-3 inline-flex min-h-11 items-center gap-0.5 text-sm text-primary-500 hover:underline">
        서류 관리 <ChevronRight className="size-4" aria-hidden />
      </Link>
    </Widget>
  );
}

/** 강사·매니저 홈: 서류 현황 — 단계별 인원 수 */
export function DocumentStatusWidget({
  cohortId,
  stages,
  total,
  forInstructor = false,
}: {
  cohortId: number;
  stages: StageCounts;
  total: number;
  forInstructor?: boolean;
}) {
  const href = `/app/c/${cohortId}/resume`;
  const items: Array<{ key: keyof StageCounts; label: string }> = [
    { key: "DRAFT", label: "초안" },
    { key: "IN_REVIEW", label: "첨삭 중" },
    { key: "DONE", label: "완성" },
    { key: "NONE", label: "미등록" },
  ];
  return (
    <Widget
      title="서류 현황"
      subtitle={`재적 ${total}명 · 수강생별 가장 덜 진행된 서류 기준`}
      density="comfortable"
      empty={total === 0 ? { message: "아직 재적 수강생이 없습니다." } : undefined}
    >
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map((it) => (
          <li key={it.key}>
            <Link
              href={forInstructor && it.key !== "NONE" ? `${href}?status=${it.key}` : href}
              className="flex flex-col gap-1.5 rounded-lg border border-neutral-200 p-3 hover:bg-neutral-50"
            >
              <StatusBadge domain="document" value={it.key} label={it.label} className="self-start" />
              <span className="text-2xl font-semibold text-neutral-900 tabular-nums">{stages[it.key]}명</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link href={forInstructor ? `${href}?status=IN_REVIEW` : href} className="mt-2 inline-flex min-h-11 items-center gap-0.5 text-sm text-primary-500 hover:underline">
        {forInstructor ? "첨삭할 서류 보기" : "서류 현황 보기"} <ChevronRight className="size-4" aria-hidden />
      </Link>
    </Widget>
  );
}
