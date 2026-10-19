"use client";

// 홈 위젯: 티켓 목록(수강생 내 티켓, 교직원 처리 대기).
import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Widget } from "@/components/Widget";
import { StatusBadge } from "@/components/StatusBadge";
import { TicketDrawer } from "@/components/tickets/TicketDrawer";
import { TICKET_TYPE_LABELS } from "@/lib/tickets/labels";
import type { TicketRow } from "@/server/ticket-queries";

/** screens.md: 내 티켓(수강생) / 처리 대기 티켓(교사). 행을 누르면 홈에서 바로 드로어가 열린다. */
export function TicketListWidget({
  cohortId,
  title,
  tickets,
  action,
  emptyMessage,
  showRequester = false,
  moreHref,
}: {
  cohortId: number;
  title: string;
  tickets: TicketRow[];
  action?: React.ReactNode;
  emptyMessage: string;
  showRequester?: boolean;
  moreHref: string;
}) {
  const [openId, setOpenId] = useState<number | null>(null);

  return (
    <>
      <Widget title={title} action={action} density="comfortable" empty={tickets.length === 0 ? { message: emptyMessage } : undefined}>
        <ul className="-mx-1 divide-y divide-neutral-200">
          {tickets.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setOpenId(t.id)}
                className="flex min-h-11 w-full items-center gap-2 rounded-md px-1 py-2 text-left hover:bg-neutral-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900">{t.title}</p>
                  <p className="text-xs text-neutral-500">
                    {showRequester ? `${t.requesterName} · ` : ""}
                    {TICKET_TYPE_LABELS[t.type]} · <span className="tabular-nums">{t.createdAt}</span>
                  </p>
                </div>
                <StatusBadge domain="ticket" value={t.status} />
              </button>
            </li>
          ))}
        </ul>
        <Link href={moreHref} className="mt-2 inline-flex min-h-11 items-center gap-0.5 text-sm text-primary-500 hover:underline">
          전체 보기 <ChevronRight className="size-4" aria-hidden />
        </Link>
      </Widget>
      <TicketDrawer cohortId={cohortId} ticketId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
