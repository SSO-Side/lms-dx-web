import Link from "next/link";
import { Role } from "@prisma/client";
import { requireAuthUser } from "@/lib/auth/session";
import { tryCohortAccess } from "@/lib/access/pageAccess";
import { hasActionPermission } from "@/lib/access/permissions";
import { todayYmd } from "@/lib/dates";
import { STAGES, type StageNo } from "@/lib/team/guide";
import { cn } from "@/lib/utils";
import { AccessDenied } from "@/components/shell/AccessDenied";
import { PageHeader } from "@/components/shell/PageHeader";
import { SectionSwitch, careerSections } from "@/components/shell/SectionSwitch";
import { StatusBadge } from "@/components/StatusBadge";
import { Alert } from "@/components/ui/alert";
import { getMyTeam, getTeamSchedule, getTeamStatusSummary, listTeamCandidates } from "@/server/team-queries";
import { StudentTeam } from "./student-team";
import { TeamBoard } from "./team-board";
import { TeamGuide } from "./guide";

interface Props {
  params: Promise<{ cohortId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

function Tabs({ items, current }: { items: Array<{ key: string; label: string; href: string }>; current: string }) {
  return (
    <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-neutral-200" aria-label="보기 전환">
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={current === t.key ? "page" : undefined}
          className={cn(
            "-mb-px inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm font-medium",
            current === t.key ? "border-primary-500 text-primary-700" : "border-transparent text-neutral-500 hover:text-neutral-900"
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

/** 단계별 팀 수·지연·미배정 요약 */
function TeamSummary({
  byStage,
  behind,
  total,
  unassigned,
  expected,
}: {
  byStage: Record<StageNo, number>;
  behind: number;
  total: number;
  unassigned: number;
  expected: StageNo;
}) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {STAGES.map((s) => (
        <li key={s.stage} className="flex flex-col gap-1.5 rounded-lg border border-neutral-200 bg-card p-3">
          <StatusBadge domain="teamStage" value={String(s.stage)} className="self-start" />
          <span className="text-2xl font-semibold text-neutral-900 tabular-nums">{byStage[s.stage]}팀</span>
        </li>
      ))}
      <li className="flex flex-col gap-1.5 rounded-lg border border-neutral-200 bg-card p-3">
        <StatusBadge domain="teamPace" value={behind > 0 ? "BEHIND" : "ON_TRACK"} label={`지연 (목표 ${expected}단계)`} className="self-start" />
        <span className="text-2xl font-semibold text-neutral-900 tabular-nums">
          {behind}/{total}팀
        </span>
      </li>
      <li className="flex flex-col gap-1.5 rounded-lg border border-neutral-200 bg-card p-3">
        <StatusBadge domain="teamPace" value={unassigned > 0 ? "BEHIND" : "ON_TRACK"} label="팀 미배정" className="self-start" />
        <span className="text-2xl font-semibold text-neutral-900 tabular-nums">{unassigned}명</span>
      </li>
    </ul>
  );
}

export default async function TeamPage({ params, searchParams }: Props) {
  const { cohortId } = await params;
  const sp = await searchParams;
  const user = await requireAuthUser();
  const today = todayYmd();

  // 수강생: 내 팀 + 단계 가이드
  if (user.role === Role.STUDENT) {
    const ctx = await tryCohortAccess(cohortId, "team:write");
    if (!ctx) return <AccessDenied />;
    const base = `/app/c/${ctx.cohortId}/team`;
    const tab = sp.tab === "guide" ? "guide" : "mine";
    const [team, schedule] = await Promise.all([getMyTeam(ctx.cohortId, ctx.user.id, today), getTeamSchedule(ctx.cohortId, today)]);
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader
          back={{ href: `/app/c/${ctx.cohortId}`, label: "반 홈" }}
          title="팀 프로젝트"
          description="기획안, 단계별 체크포인트, 주간 로그를 팀과 함께 관리합니다."
        />
        <Tabs
          current={tab}
          items={[
            { key: "mine", label: "내 팀", href: base },
            { key: "guide", label: "단계 가이드", href: `${base}?tab=guide` },
          ]}
        />
        {tab === "guide" ? (
          <TeamGuide targets={schedule.targets} current={team?.project.stage} />
        ) : team ? (
          <StudentTeam cohortId={ctx.cohortId} team={team} userId={ctx.user.id} today={today} />
        ) : (
          <div className="rounded-xl border border-neutral-200 bg-card px-4 py-10 text-center">
            <p className="text-base text-neutral-700">아직 소속된 팀이 없습니다.</p>
            <p className="mt-1 text-sm text-neutral-500">강사가 팀장과 팀원을 배정하면 여기에 팀 프로젝트가 나타납니다.</p>
            <Link href={`${base}?tab=guide`} className="mt-3 inline-flex min-h-11 items-center text-sm text-primary-500 hover:underline">
              단계 가이드 먼저 보기
            </Link>
          </div>
        )}
      </div>
    );
  }

  // 강사·매니저·슈퍼어드민: 팀 목록 (강사·ADMIN만 관리)
  const ctx = await tryCohortAccess(cohortId, "team:feedback");
  if (!ctx) return <AccessDenied />;
  const canManage = hasActionPermission(ctx.role, "team:manage");
  const [summary, candidates] = await Promise.all([
    getTeamStatusSummary(ctx.cohortId, today),
    canManage ? listTeamCandidates(ctx.cohortId) : Promise.resolve([]),
  ]);

  return (
    <>
      <SectionSwitch items={careerSections(ctx.cohortId)} current="team" />
      <PageHeader
        back={{ href: `/app/c/${ctx.cohortId}`, label: "반 홈" }}
        title={canManage ? "팀 프로젝트" : "팀 프로젝트 현황"}
        description={
          canManage
            ? "팀을 만들고, 행을 눌러 기획안·마일스톤·주간 로그를 확인하고 피드백과 단계 승인을 합니다."
            : "팀별 진행 단계와 지연 여부입니다. 행을 누르면 상세를 볼 수 있습니다(열람 전용)."
        }
      />
      <div className="space-y-4">
        <TeamSummary
          byStage={summary.byStage}
          behind={summary.behind.length}
          total={summary.total}
          unassigned={summary.unassigned}
          expected={summary.expected}
        />
        {summary.behind.length > 0 && (
          <Alert tone="warning">
            목표 단계({summary.expected}단계)보다 늦은 팀: {summary.behind.map((t) => t.name).join(", ")}. 강사 면담으로 연결하세요.
          </Alert>
        )}
        <TeamBoard cohortId={ctx.cohortId} rows={summary.rows} expected={summary.expected} canManage={canManage} candidates={candidates} />
      </div>
    </>
  );
}
