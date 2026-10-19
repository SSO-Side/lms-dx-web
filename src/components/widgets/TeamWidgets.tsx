// 홈 위젯: 팀 프로젝트(수강생 내 팀, 교직원 단계별 요약).
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Widget } from "@/components/Widget";
import { StatusBadge } from "@/components/StatusBadge";
import { TeamStageSteps } from "@/components/team/TeamStageSteps";
import { stageGuide } from "@/lib/team/guide";
import type { TeamDetail, TeamStatusSummary } from "@/server/team-queries";

/** 수강생 홈: 내 팀 프로젝트 — 현재 단계, 다음 체크포인트, 최신 피드백 */
export function MyTeamProjectWidget({ cohortId, team }: { cohortId: number; team: TeamDetail | null }) {
  const href = `/app/c/${cohortId}/team`;
  if (!team) {
    return <Widget title="내 팀 프로젝트" density="comfortable" empty={{ message: "아직 소속된 팀이 없습니다. 강사가 팀을 배정하면 표시됩니다." }} />;
  }
  const p = team.project;
  const next = stageGuide(p.stage).checkpoints.find((c) => !team.checks[c.key]?.done) ?? null;
  const feedback = team.feedbacks[0] ?? null;

  return (
    <Widget
      title="내 팀 프로젝트"
      subtitle={`${team.name} · ${p.title}`}
      density="comfortable"
      action={team.behind ? <StatusBadge domain="teamPace" value="BEHIND" /> : <StatusBadge domain="teamStage" value={String(p.stage)} />}
    >
      <TeamStageSteps stage={p.stage} />
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-xs font-medium text-neutral-500">다음 체크포인트</dt>
          <dd className="mt-0.5 text-neutral-900">{next ? next.label : `${p.stage}단계 체크포인트 완료 — 강사 승인을 기다립니다.`}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-neutral-500">최신 피드백</dt>
          <dd className="mt-0.5">
            {feedback ? (
              <>
                <span className="line-clamp-2 text-neutral-800">{feedback.comment}</span>
                <span className="text-xs text-neutral-500 tabular-nums">
                  {feedback.instructorName} · {feedback.createdAt.slice(0, 10)}
                </span>
              </>
            ) : (
              <span className="text-neutral-500">아직 없습니다.</span>
            )}
          </dd>
        </div>
      </dl>
      <Link href={href} className="mt-3 inline-flex min-h-11 items-center gap-0.5 text-sm text-primary-500 hover:underline">
        팀 프로젝트 열기 <ChevronRight className="size-4" aria-hidden />
      </Link>
    </Widget>
  );
}

/** 강사·매니저 홈: 팀 현황 — 지연 팀 수와 목록 */
export function TeamStatusWidget({ cohortId, summary }: { cohortId: number; summary: TeamStatusSummary }) {
  const href = `/app/c/${cohortId}/team`;
  return (
    <Widget
      title="팀 현황"
      subtitle={`${summary.total}팀 · 오늘 목표 ${summary.expected}단계${summary.unassigned > 0 ? ` · 미배정 ${summary.unassigned}명` : ""}`}
      empty={
        summary.total === 0
          ? {
              message: "아직 등록된 팀이 없습니다.",
              action: (
                <Link href={href} className="text-sm text-primary-500 hover:underline">
                  팀 프로젝트로 이동
                </Link>
              ),
            }
          : undefined
      }
    >
      <div className="flex items-center gap-3">
        <StatusBadge domain="teamPace" value={summary.behind.length > 0 ? "BEHIND" : "ON_TRACK"} label={summary.behind.length > 0 ? "지연" : "모두 정상"} />
        <span className="text-2xl font-semibold text-neutral-900 tabular-nums">
          {summary.behind.length}
          <span className="text-sm font-normal text-neutral-500">/{summary.total}팀 지연</span>
        </span>
      </div>
      {summary.behind.length > 0 && (
        <ul className="mt-3 divide-y divide-neutral-200 rounded-lg border border-neutral-200">
          {summary.behind.slice(0, 5).map((t) => (
            <li key={t.id} className="flex min-h-10 items-center justify-between gap-2 px-3 text-sm">
              <span className="min-w-0 truncate">
                <span className="font-medium text-neutral-900">{t.name}</span> <span className="text-neutral-500">{t.leaderName}</span>
              </span>
              <StatusBadge domain="teamStage" value={String(t.stage)} />
            </li>
          ))}
        </ul>
      )}
      <Link href={href} className="mt-2 inline-flex min-h-11 items-center gap-0.5 text-sm text-primary-500 hover:underline">
        팀 프로젝트 보기 <ChevronRight className="size-4" aria-hidden />
      </Link>
    </Widget>
  );
}
