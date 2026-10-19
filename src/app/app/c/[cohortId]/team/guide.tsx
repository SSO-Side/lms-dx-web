// 팀 프로젝트 > 단계 가이드: 단계별 목표·체크포인트와 이 반 일정 기준 목표일(정적 내용).
import { CheckCircle2 } from "lucide-react";
import { COMPLETION_CHECKLIST, STAGES, type StageNo } from "@/lib/team/guide";
import { cn } from "@/lib/utils";

/** 단계 가이드 (정적): PRD M5 단계 표 + 완료 체크리스트. 목표일은 이 반 일정으로 환산 */
export function TeamGuide({ targets, current }: { targets: Record<StageNo, string>; current?: StageNo }) {
  return (
    <div className="space-y-5">
      <ol className="space-y-3">
        {STAGES.map((s) => (
          <li key={s.stage} className={cn("rounded-xl border bg-card p-4", current === s.stage ? "border-primary-300" : "border-neutral-200")}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold text-neutral-900">
                {s.stage}. {s.name}
                {current === s.stage && <span className="ml-2 text-sm font-medium text-primary-700">우리 팀 현재 단계</span>}
              </h3>
              <p className="text-sm text-neutral-500 tabular-nums">
                {s.period} · 목표일 {targets[s.stage]}
              </p>
            </div>
            <p className="mt-1 text-sm text-neutral-700">목표: {s.goal}</p>
            <ul className="mt-2 space-y-1 text-sm text-neutral-700">
              {s.checkpoints.map((c) => (
                <li key={c.key} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-neutral-400" aria-hidden />
                  {c.label}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <section className="rounded-xl border border-neutral-200 bg-card p-4">
        <h3 className="font-semibold text-neutral-900">프로젝트 완료 체크리스트</h3>
        <ul className="mt-2 space-y-1 text-sm text-neutral-700">
          {COMPLETION_CHECKLIST.map((c) => (
            <li key={c.key} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-neutral-400" aria-hidden />
              {c.label}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-neutral-500">
          반 공통 권장 마일스톤입니다. 시스템이 진행을 막지는 않으며, 목표일보다 늦은 팀은 강사 화면에 &quot;지연&quot;으로 표시됩니다.
        </p>
      </section>
    </div>
  );
}
