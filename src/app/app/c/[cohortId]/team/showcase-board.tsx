"use client";

// 팀 프로젝트 > 쇼케이스 보드(교직원): 쇼케이스 목록과 검토·공개 승인 드로어.
import { useState } from "react";
import type { Role } from "@prisma/client";
import type { ShowcaseRow } from "@/server/showcase-queries";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { ShowcaseReviewDrawer } from "@/components/showcase/ShowcaseReviewDrawer";

/** 교직원 쇼케이스 목록 (심사 중을 위로). 행 클릭 → 검토 드로어 */
export function ShowcaseBoard({ cohortId, role, rows }: { cohortId: number; role: Role; rows: ShowcaseRow[] }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const sorted = [...rows].sort((a, b) => Number(b.status === "IN_REVIEW") - Number(a.status === "IN_REVIEW"));
  return (
    <>
      <DataTable
        data={sorted}
        getRowKey={(r) => r.id}
        onRowClick={(r) => setOpenId(r.id)}
        emptyMessage="아직 쇼케이스를 작성한 팀이 없습니다. 팀원이 팀 프로젝트 화면의 쇼케이스 탭에서 초안을 만듭니다."
        columns={[
          {
            header: "팀",
            cell: (r) => (
              <span className="block min-w-0">
                <span className="font-medium text-neutral-900">{r.teamName}</span>
                <span className="block truncate text-xs text-neutral-500">{r.projectTitle}</span>
              </span>
            ),
          },
          { header: "상태", cell: (r) => <StatusBadge domain="showcase" value={r.status} /> },
          {
            header: "팀원 동의",
            cell: (r) => (r.status === "IN_REVIEW" || r.status === "PUBLISHED" ? `${r.consentCount}/${r.memberCount}` : "—"),
            className: "tabular-nums whitespace-nowrap",
          },
          {
            header: "강사 검토",
            cell: (r) => (r.status === "IN_REVIEW" || r.status === "PUBLISHED" ? (r.reviewed ? "완료" : "대기") : "—"),
            className: "hidden sm:table-cell",
          },
          { header: "최근 수정", cell: (r) => r.updatedAt, className: "hidden md:table-cell whitespace-nowrap tabular-nums text-neutral-600" },
        ]}
      />
      <ShowcaseReviewDrawer cohortId={cohortId} role={role} showcaseId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
