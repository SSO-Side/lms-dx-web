import { Check } from "lucide-react";
import { STAGES, type StageNo } from "@/lib/team/guide";
import { cn } from "@/lib/utils";

/**
 * 팀 프로젝트 4단계 진행: 착수 → MVP → 고도화 → 서류 반영.
 * 지난 단계는 체크 아이콘, 현재 단계는 굵게, 목표 단계는 "목표" 표기 (색만으로 구분하지 않음).
 */
export function TeamStageSteps({
  stage,
  targets,
  expected,
  className,
}: {
  stage: StageNo;
  targets?: Record<StageNo, string>;
  expected?: StageNo;
  className?: string;
}) {
  return (
    <ol className={cn("grid grid-cols-4 gap-1", className)} aria-label={`현재 ${stage}단계 ${STAGES[stage - 1].name}`}>
      {STAGES.map((s) => {
        const passed = s.stage < stage;
        const current = s.stage === stage;
        return (
          <li key={s.stage} className="min-w-0">
            <div className={cn("h-1.5 rounded-full", s.stage <= stage ? "bg-primary-500" : "bg-neutral-200")} aria-hidden />
            <p
              className={cn(
                "mt-1 flex items-center gap-0.5 truncate text-xs",
                current ? "font-semibold text-primary-700" : passed ? "text-neutral-600" : "text-neutral-500"
              )}
              aria-current={current ? "step" : undefined}
            >
              {passed && <Check className="size-3 shrink-0" aria-hidden />}
              {s.stage}. {s.name}
            </p>
            {targets && (
              <p className={cn("truncate text-xs tabular-nums", expected === s.stage ? "font-medium text-neutral-700" : "text-neutral-500")}>
                {expected === s.stage ? "목표 " : "~"}
                {targets[s.stage].slice(5)}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
