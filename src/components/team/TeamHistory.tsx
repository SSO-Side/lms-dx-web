// 팀 프로젝트 기록 보기: 강사 피드백, 주간 로그, 기획안.
import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import type { FeedbackRow, LogRow, TeamDetail } from "@/server/team-queries";
import { STAGES } from "@/lib/team/guide";

/** 강사 피드백 목록 (최신순) */
export function FeedbackList({ feedbacks, empty = "아직 강사 피드백이 없습니다." }: { feedbacks: FeedbackRow[]; empty?: string }) {
  if (feedbacks.length === 0) return <p className="text-sm text-neutral-500">{empty}</p>;
  return (
    <ul className="space-y-2">
      {feedbacks.map((f) => (
        <li key={f.id} className="rounded-lg border border-neutral-200 p-3">
          <p className="text-xs text-neutral-500 tabular-nums">
            {f.instructorName} · {f.stage}단계 {STAGES[f.stage - 1]?.name ?? ""} · {f.createdAt}
          </p>
          <p className="mt-1 text-sm whitespace-pre-wrap text-neutral-800">{f.comment}</p>
        </li>
      ))}
    </ul>
  );
}

/** 개인 주간 로그 (진행 / 막힌 점 / 해결 / 수치) */
export function LogList({ logs, empty = "아직 주간 로그가 없습니다." }: { logs: LogRow[]; empty?: string }) {
  if (logs.length === 0) return <p className="text-sm text-neutral-500">{empty}</p>;
  return (
    <ul className="space-y-2">
      {logs.map((l) => (
        <li key={l.id} className="rounded-lg border border-neutral-200 p-3 text-sm">
          <p className="text-xs text-neutral-500 tabular-nums">
            <span className="font-medium text-neutral-700">{l.userName}</span> · {l.weekOf} 주
          </p>
          <dl className="mt-1.5 space-y-1">
            <LogLine label="진행" value={l.progress} />
            <LogLine label="막힌 점" value={l.blocker} />
            <LogLine label="해결" value={l.resolution} />
            <LogLine label="수치" value={l.metric} />
          </dl>
        </li>
      ))}
    </ul>
  );
}

function LogLine({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[4rem_1fr] gap-2">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="whitespace-pre-wrap text-neutral-800">{value}</dd>
    </div>
  );
}

/** 기획안 열람: 소개, 문제 정의, 핵심 기능, 기술 스택, 역할 분담, 링크 */
export function ProjectPlanView({ team }: { team: TeamDetail }) {
  const p = team.project;
  const empty = <span className="text-neutral-500">아직 작성하지 않았습니다.</span>;
  return (
    <dl className="space-y-3 text-sm">
      <PlanItem label="프로젝트 소개">{p.summary ? <span className="whitespace-pre-wrap">{p.summary}</span> : empty}</PlanItem>
      <PlanItem label="문제 정의">{p.plan.problem || empty}</PlanItem>
      <PlanItem label="핵심 기능">
        {p.plan.features.length > 0 ? (
          <ol className="list-decimal space-y-0.5 pl-5">
            {p.plan.features.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ol>
        ) : (
          empty
        )}
      </PlanItem>
      <PlanItem label="기술 스택">
        {p.techStack.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {p.techStack.map((t) => (
              <li key={t} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
                {t}
              </li>
            ))}
          </ul>
        ) : (
          empty
        )}
      </PlanItem>
      <PlanItem label="역할 분담">
        {p.plan.roles.length > 0 ? (
          <ul className="space-y-0.5">
            {p.plan.roles.map((r, i) => (
              <li key={i}>
                <span className="font-medium text-neutral-900">{r.name}</span> {r.part && <span className="text-neutral-600">— {r.part}</span>}
              </li>
            ))}
          </ul>
        ) : (
          empty
        )}
      </PlanItem>
      <PlanItem label="링크">
        <div className="flex flex-col gap-1">
          <ExtLink href={p.repoUrl} label="저장소" />
          <ExtLink href={p.deployUrl} label="배포 URL" />
        </div>
      </PlanItem>
    </dl>
  );
}

function PlanItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="mb-0.5 text-xs font-medium text-neutral-500">{label}</dt>
      <dd className="text-neutral-800">{children}</dd>
    </div>
  );
}

/** 저장 시 http(s)만 허용하므로 그대로 새 탭으로 연다 */
function ExtLink({ href, label }: { href: string | null; label: string }) {
  if (!href) return <span className="text-neutral-500">{label}: 미등록</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1 break-all text-primary-500 hover:underline">
      {label}: {href} <ExternalLink className="size-3.5 shrink-0" aria-hidden />
    </a>
  );
}
