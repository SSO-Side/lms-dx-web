// 전체 반 요약(/app/overview): 강사·매니저는 담당 반, 학원 관리자는 학원 전체 반의 출결·티켓 요약.
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireAuthUser } from "@/lib/auth/session";
import { listOverviewCohorts } from "@/server/academy-queries";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";
import { Widget } from "@/components/Widget";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { ROLE_LABELS } from "@/components/shell/nav";
import { getCohortSummary, type CohortSummary } from "@/server/dashboard-queries";

export default async function OverviewPage() {
  const user = await requireAuthUser();

  const cohorts = await listOverviewCohorts(user);

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
      <PageHeader title="담당 반" description="반 카드를 누르면 반 홈으로, 요약 항목을 누르면 해당 화면으로 이동합니다." />
      {cohorts.length === 0 ? (
        <Widget title="담당 반" empty={{ message: "아직 배정된 반이 없습니다. 학원 관리자에게 문의해 주세요." }} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {cohorts.map((c) => (
            // 카드 전체는 반 홈 링크(after로 넓힘), 요약 숫자는 그 위에 얹은 개별 링크
            <li
              key={c.id}
              className="group relative flex items-center gap-3 rounded-xl border border-neutral-200 bg-card p-4 transition-colors duration-150 hover:border-primary-300 hover:bg-primary-50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link href={`/app/c/${c.id}`} className="truncate font-semibold text-neutral-900 after:absolute after:inset-0 after:rounded-xl">
                    {c.name}
                  </Link>
                  <StatusBadge domain="cohortStatus" value={c.status} />
                </div>
                <p className="mt-1 text-sm text-neutral-500 tabular-nums">
                  {c.room ?? "강의실 미정"} · {formatDate(c.startDate)} ~ {formatDate(c.endDate)}
                </p>
                <CohortSummaryLine cohortId={c.id} summary={summaries.get(c.id) ?? null} />
              </div>
              <ChevronRight className="size-5 shrink-0 text-neutral-400 group-hover:text-primary-500" aria-hidden />
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}

function CohortSummaryLine({ cohortId, summary }: { cohortId: number; summary: CohortSummary | null }) {
  if (!summary) return <p className="mt-2 text-xs text-status-danger-fg">요약을 불러오지 못했습니다.</p>;
  const base = `/app/c/${cohortId}`;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
      <SummaryLink href={`${base}/attendance?tab=roster&grade=DANGER`}>
        <StatusBadge domain="attendance" value="DANGER" label={`위험 ${summary.danger}`} />
      </SummaryLink>
      <SummaryLink href={`${base}/attendance?tab=roster&grade=WARN`}>
        <StatusBadge domain="attendance" value="WARN" label={`주의 ${summary.warn}`} />
      </SummaryLink>
      <SummaryLink href={`${base}/tickets`}>
        <StatusBadge domain="ticket" value="PENDING" label={`대기 티켓 ${summary.pendingTickets}`} />
      </SummaryLink>
      {summary.todayIsTraining && (
        <SummaryLink href={`${base}/attendance`}>
          <StatusBadge
            domain="attendance"
            value={summary.todayClosed ? "NORMAL" : "WARN"}
            label={summary.todayClosed ? "오늘 출결 확인" : "오늘 출결 미확인"}
          />
        </SummaryLink>
      )}
    </div>
  );
}

function SummaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="relative z-10 inline-flex min-h-8 items-center rounded-md hover:underline">
      {children}
    </Link>
  );
}
