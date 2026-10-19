"use client";

// 서류 > 첨삭 보드(강사): 같은 반 수강생 서류 표와 검토 드로어.
import { useState } from "react";
import type { CohortDocumentRow } from "@/server/document-queries";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents/labels";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { DocumentReviewDrawer } from "@/components/documents/DocumentReviewDrawer";

/** 강사: 같은 반 수강생 서류 표. 행 클릭 → 검토 드로어. */
export function ReviewBoard({ cohortId, rows, emptyMessage }: { cohortId: number; rows: CohortDocumentRow[]; emptyMessage: string }) {
  const [openId, setOpenId] = useState<number | null>(null);
  return (
    <>
      <DataTable
        data={rows}
        getRowKey={(r) => r.id}
        onRowClick={(r) => setOpenId(r.id)}
        emptyMessage={emptyMessage}
        columns={[
          {
            header: "수강생",
            cell: (r) => (
              <span>
                <span className="font-medium text-neutral-900">{r.ownerName}</span>{" "}
                <span className="text-xs text-neutral-500">{r.ownerLoginId}</span>
              </span>
            ),
          },
          { header: "유형", cell: (r) => DOCUMENT_TYPE_LABELS[r.type], className: "whitespace-nowrap" },
          { header: "제목", cell: (r) => <span className="line-clamp-1">{r.title}</span>, className: "hidden md:table-cell" },
          { header: "상태", cell: (r) => <StatusBadge domain="document" value={r.status} /> },
          { header: "버전", cell: (r) => `v${r.versionCount}`, align: "right", className: "hidden sm:table-cell tabular-nums" },
          { header: "최종 수정", cell: (r) => r.updatedAt, className: "whitespace-nowrap tabular-nums text-neutral-600" },
        ]}
      />
      <DocumentReviewDrawer cohortId={cohortId} documentId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
