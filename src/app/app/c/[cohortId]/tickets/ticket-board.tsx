"use client";

// 티켓 > 반 티켓 보드(교직원): 티켓 표와 상세 드로어(승인·반려 등 상태 변경).
import { useState } from "react";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { TicketDrawer } from "@/components/tickets/TicketDrawer";
import { TICKET_TYPE_LABELS } from "@/lib/tickets/labels";
import type { TicketRow } from "@/server/ticket-queries";

export function TicketBoard({
  cohortId,
  tickets,
  initialTicketId,
}: {
  cohortId: number;
  tickets: TicketRow[];
  initialTicketId: number | null;
}) {
  const [openId, setOpenId] = useState<number | null>(initialTicketId);

  const columns: Column<TicketRow>[] = [
    { header: "유형", cell: (t) => TICKET_TYPE_LABELS[t.type], className: "whitespace-nowrap" },
    { header: "요청자", cell: (t) => t.requesterName, className: "whitespace-nowrap" },
    { header: "제목", cell: (t) => <span className="font-medium text-neutral-900">{t.title}</span> },
    { header: "상태", cell: (t) => <StatusBadge domain="ticket" value={t.status} /> },
    { header: "접수일", cell: (t) => t.createdAt, className: "whitespace-nowrap tabular-nums text-neutral-500" },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={tickets}
        getRowKey={(t) => t.id}
        onRowClick={(t) => setOpenId(t.id)}
        emptyMessage="이 상태의 티켓이 없습니다."
      />
      <TicketDrawer cohortId={cohortId} ticketId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
