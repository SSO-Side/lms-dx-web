"use client";

import { useState } from "react";
import type { LeadRow } from "@/server/lead-queries";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody } from "@/components/ui/sheet";

/** 문의 표 + 행 클릭 드로어. 입력값은 텍스트로만 출력한다 (HTML로 해석하지 않음). */
export function LeadBoard({ rows }: { rows: LeadRow[] }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const open = rows.find((r) => r.id === openId) ?? null;
  return (
    <>
      <DataTable
        data={rows}
        getRowKey={(r) => r.id}
        onRowClick={(r) => setOpenId(r.id)}
        emptyMessage="아직 들어온 문의가 없습니다. 쇼케이스가 공개되면 기업이 마켓플레이스에서 문의할 수 있습니다."
        columns={[
          {
            header: "유형",
            cell: (r) => (
              <span className="flex flex-wrap gap-1">
                <StatusBadge domain="lead" value={r.type} />
                {r.isNew && <StatusBadge domain="lead" value="NEW" />}
              </span>
            ),
          },
          {
            header: "기업",
            cell: (r) => (
              <span className="block min-w-0">
                <span className="font-medium text-neutral-900">{r.company}</span>
                <span className="block text-xs text-neutral-500">{r.contactName}</span>
              </span>
            ),
          },
          {
            header: "프로젝트",
            cell: (r) => (
              <span className="block min-w-0">
                <span className="line-clamp-1 text-neutral-800">{r.projectTitle}</span>
                <span className="block text-xs text-neutral-500">{r.teamName}</span>
              </span>
            ),
            className: "hidden md:table-cell",
          },
          { header: "접수", cell: (r) => r.createdAt, className: "whitespace-nowrap tabular-nums text-neutral-600" },
        ]}
      />
      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent>
          {open && (
            <>
              <SheetHeader>
                <SheetTitle>{open.company}</SheetTitle>
                <SheetDescription render={<div />} className="flex flex-wrap items-center gap-2">
                  <StatusBadge domain="lead" value={open.type} />
                  <span className="tabular-nums">접수 {open.createdAt}</span>
                </SheetDescription>
              </SheetHeader>
              <SheetBody className="space-y-5">
                <dl className="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-2 text-sm">
                  <dt className="text-neutral-500">담당자</dt>
                  <dd className="break-words text-neutral-900">{open.contactName}</dd>
                  <dt className="text-neutral-500">연락처</dt>
                  <dd className="break-all text-neutral-900">{open.contact}</dd>
                  <dt className="text-neutral-500">프로젝트</dt>
                  <dd className="text-neutral-900">
                    {open.projectTitle} <span className="text-neutral-500">({open.teamName})</span>
                  </dd>
                </dl>
                <section className="space-y-1.5">
                  <h3 className="text-sm font-semibold text-neutral-900">문의 내용</h3>
                  <p className="rounded-lg bg-neutral-50 p-3 text-sm whitespace-pre-wrap break-words text-neutral-800">{open.message}</p>
                </section>
                <p className="text-xs text-neutral-500">답변은 학원 담당자가 위 연락처로 직접 합니다. 이 시스템에서 메일을 보내지 않습니다.</p>
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
