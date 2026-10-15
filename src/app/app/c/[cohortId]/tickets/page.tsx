import Link from "next/link";
import { Role } from "@prisma/client";
import { requireAuthUser } from "@/lib/auth/session";
import { tryCohortAccess } from "@/lib/access/pageAccess";
import { db } from "@/lib/db";
import { dateToYmd } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { AccessDenied } from "@/components/shell/AccessDenied";
import { PageHeader } from "@/components/shell/PageHeader";
import { listTickets, countTicketsByStatus, STATUS_GROUPS } from "@/server/ticket-queries";
import { TicketBoard } from "./ticket-board";
import { StudentTickets } from "./student-tickets";

interface Props {
  params: Promise<{ cohortId: string }>;
  searchParams: Promise<{ status?: string; ticket?: string; new?: string }>;
}

const TABS = [
  { key: "PENDING", label: "대기" },
  { key: "IN_REVIEW", label: "검토 중" },
  { key: "NEEDS_REVISION", label: "보완 요청" },
  { key: "DONE", label: "완료" },
] as const;

export default async function TicketsPage({ params, searchParams }: Props) {
  const { cohortId } = await params;
  const sp = await searchParams;
  const user = await requireAuthUser();
  const initialTicketId = sp.ticket ? parseInt(sp.ticket, 10) || null : null;

  if (user.role === Role.STUDENT) {
    const ctx = await tryCohortAccess(cohortId, "ticket:readOwn");
    if (!ctx) return <AccessDenied />;
    const [tickets, days] = await Promise.all([
      listTickets(ctx.cohortId, { requesterId: ctx.user.id }),
      db.trainingDay.findMany({ where: { cohortId: ctx.cohortId, isTraining: true }, select: { date: true }, orderBy: { date: "asc" } }),
    ]);
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="티켓" description="결석계와 문의를 접수하고 처리 상태를 확인합니다." />
        <StudentTickets
          cohortId={ctx.cohortId}
          tickets={tickets}
          trainingDates={days.map((d) => dateToYmd(d.date))}
          initialTicketId={initialTicketId}
          initialNew={sp.new === "absence" || sp.new === "inquiry" ? sp.new : null}
        />
      </div>
    );
  }

  const ctx = await tryCohortAccess(cohortId, "ticket:readCohort");
  if (!ctx) return <AccessDenied />;
  const tab = TABS.find((t) => t.key === sp.status)?.key ?? "PENDING";
  const [tickets, counts] = await Promise.all([
    listTickets(ctx.cohortId, { statuses: STATUS_GROUPS[tab] }),
    countTicketsByStatus(ctx.cohortId),
  ]);

  return (
    <>
      <PageHeader title="티켓" description="결석계·상담·서류 요청을 처리합니다. 행을 누르면 상세와 처리 버튼이 열립니다." />
      <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-neutral-200" aria-label="상태">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/app/c/${ctx.cohortId}/tickets?status=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium",
              tab === t.key ? "border-primary-500 text-primary-700" : "border-transparent text-neutral-500 hover:text-neutral-900"
            )}
          >
            {t.label}
            <span className="rounded-full bg-neutral-100 px-1.5 text-xs text-neutral-600 tabular-nums">{counts[t.key]}</span>
          </Link>
        ))}
      </nav>
      <TicketBoard cohortId={ctx.cohortId} tickets={tickets} initialTicketId={initialTicketId} />
    </>
  );
}
