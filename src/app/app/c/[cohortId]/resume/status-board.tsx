import type { DocumentType } from "@prisma/client";
import type { StudentDocumentStatusRow, CohortStageRow } from "@/server/document-queries";
import type { StageCounts } from "@/lib/documents/summary";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents/labels";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";

const TYPES: DocumentType[] = ["RESUME", "COVER_LETTER", "PORTFOLIO"];
const STAGE_TILES: Array<{ key: keyof StageCounts; label: string }> = [
  { key: "NONE", label: "미등록" },
  { key: "DRAFT", label: "초안" },
  { key: "IN_REVIEW", label: "첨삭 중" },
  { key: "DONE", label: "완성" },
];

/** 단계별 인원 요약 숫자 (대표 단계 = 가장 덜 진행된 서류의 상태) */
export function StageSummary({ stages, total }: { stages: StageCounts; total: number }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <div className="rounded-xl border border-neutral-200 bg-card p-4">
        <dt className="text-sm text-neutral-500">재적 수강생</dt>
        <dd className="mt-1 text-2xl font-semibold text-neutral-900 tabular-nums">{total}명</dd>
      </div>
      {STAGE_TILES.map((t) => (
        <div key={t.key} className="rounded-xl border border-neutral-200 bg-card p-4">
          <dt>
            <StatusBadge domain="document" value={t.key} label={t.label} />
          </dt>
          <dd className="mt-2 text-2xl font-semibold text-neutral-900 tabular-nums">{stages[t.key]}명</dd>
        </div>
      ))}
    </dl>
  );
}

/** 매니저·슈퍼어드민: 수강생별 서류 상태만 (파일 열람·다운로드 없음) */
export function StudentStatusTable({ rows }: { rows: StudentDocumentStatusRow[] }) {
  return (
    <DataTable
      data={rows}
      getRowKey={(r) => r.studentId}
      emptyMessage="아직 재적 수강생이 없습니다."
      columns={[
        {
          header: "수강생",
          cell: (r) => (
            <span>
              <span className="font-medium text-neutral-900">{r.name}</span> <span className="text-xs text-neutral-500">{r.loginId}</span>
            </span>
          ),
        },
        { header: "진행 단계", cell: (r) => <StatusBadge domain="document" value={r.stage} /> },
        ...TYPES.map((t) => ({
          header: DOCUMENT_TYPE_LABELS[t],
          className: "hidden md:table-cell",
          cell: (r: StudentDocumentStatusRow) =>
            r.byType[t] ? <StatusBadge domain="document" value={r.byType[t]} /> : <span className="text-sm text-neutral-400">없음</span>,
        })),
        { header: "최종 수정", cell: (r) => r.updatedAt ?? "—", className: "whitespace-nowrap tabular-nums text-neutral-600" },
      ]}
    />
  );
}

/** 슈퍼어드민: 학원 반별 단계 인원 */
export function CohortStageTable({ rows, currentCohortId }: { rows: CohortStageRow[]; currentCohortId: number }) {
  return (
    <DataTable
      data={rows}
      getRowKey={(r) => r.cohortId}
      emptyMessage="반이 없습니다."
      columns={[
        {
          header: "반",
          cell: (r) => (
            <span className={r.cohortId === currentCohortId ? "font-semibold text-neutral-900" : "text-neutral-900"}>
              {r.name}
              {r.cohortId === currentCohortId && <span className="ml-1.5 text-xs font-normal text-neutral-500">(현재 반)</span>}
            </span>
          ),
        },
        { header: "재적", cell: (r) => `${r.enrolled}명`, align: "right", className: "tabular-nums" },
        ...STAGE_TILES.map((t) => ({
          header: t.label,
          align: "right" as const,
          className: "tabular-nums",
          cell: (r: CohortStageRow) => `${r.stages[t.key]}명`,
        })),
      ]}
    />
  );
}
