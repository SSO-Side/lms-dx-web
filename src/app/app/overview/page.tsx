import Link from "next/link";
import { Role } from "@prisma/client";
import { ChevronRight } from "lucide-react";
import { requireAuthUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";
import { Widget } from "@/components/Widget";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { ROLE_LABELS } from "@/components/shell/nav";
import { getCohortSummary, type CohortSummary } from "@/server/dashboard-queries";

const cohortSelect = { id: true, name: true, room: true, startDate: true, endDate: true, status: true } as const;

export default async function OverviewPage() {
  const user = await requireAuthUser();

  const cohorts =
    user.role === Role.ACADEMY_ADMIN || user.role === Role.ADMIN
      ? await db.cohort.findMany({
          where: user.academyId ? { academyId: user.academyId } : {},
          orderBy: { id: "asc" },
          select: cohortSelect,
        })
      : (
          await db.cohortStaff.findMany({
            where: { userId: user.id },
            select: { cohort: { select: cohortSelect } },
          })
        ).map((s) => s.cohort);

  // 반별 요약 (위젯 단위 오류 격리)
  const summaries = new Map<number, CohortSummary | null>(
    await Promise.all(
      cohorts.map(async (c) => [c.id, await getCohortSummary(c.id).catch(() => null)] as const)
    )
  );

  return (
    <AppShell
      title="담당 반"
      nav={[{ label: "담당 반", href: "/app/overview", icon: "overview", exact: true }]}
      user={{ name: user.name, roleLabel: ROLE_LABELS[user.role] }}
    >
      <PageHeader title="담당 반" description="반을 선택하면 해당 반 홈으로 이동합니다." />
      {cohorts.length === 0 ? (
        <Widget title="담당 반" empty={{ message: "아직 배정된 반이 없습니다. 학원 관리자에게 문의해 주세요." }} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {cohorts.map((c) => (
            <li key={c.id}>
              <Link
                href={`/app/c/${c.id}`}
                className="group flex items-center gap-3 rounded-xl border border-neutral-200 bg-card p-4 transition-colors duration-150 hover:border-primary-300 hover:bg-primary-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-neutral-900">{c.name}</p>
                    <StatusBadge domain="cohortStatus" value={c.status} />
                  </div>
                  <p className="mt-1 text-sm text-neutral-500 tabular-nums">
                    {c.room ?? "강의실 미정"} · {formatDate(c.startDate)} ~ {formatDate(c.endDate)}
                  </p>
                  <CohortSummaryLine summary={summaries.get(c.id) ?? null} />
                </div>
                <ChevronRight className="size-5 shrink-0 text-neutral-400 group-hover:text-primary-500" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}

function CohortSummaryLine({ summary }: { summary: CohortSummary | null }) {
  if (!summary) return <p className="mt-2 text-xs text-status-danger-fg">요약을 불러오지 못했습니다.</p>;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
      <StatusBadge domain="attendance" value="DANGER" label={`위험 ${summary.danger}`} />
      <StatusBadge domain="attendance" value="WARN" label={`주의 ${summary.warn}`} />
      <StatusBadge domain="ticket" value="PENDING" label={`대기 티켓 ${summary.pendingTickets}`} />
      {summary.todayIsTraining && (
        <StatusBadge
          domain="attendance"
          value={summary.todayClosed ? "NORMAL" : "WARN"}
          label={summary.todayClosed ? "오늘 출결 확인" : "오늘 출결 미확인"}
        />
      )}
    </div>
  );
}
