// 서류 진행 단계 표시(초안 → 첨삭 중 → 완성).
import type { DocumentStatus } from "@prisma/client";
import { Check } from "lucide-react";
import { DOCUMENT_STATUSES, DOCUMENT_STATUS_LABELS } from "@/lib/documents/labels";
import { cn } from "@/lib/utils";

/** 서류 단계 진행 표시: 초안 → 첨삭 중 → 완성. 지난 단계는 체크 아이콘, 현재 단계는 굵게 (색만으로 구분하지 않음). */
export function StageSteps({ status, className }: { status: DocumentStatus | null; className?: string }) {
  const current = status ? DOCUMENT_STATUSES.indexOf(status) : -1;
  return (
    <ol className={cn("grid grid-cols-3 gap-1", className)} aria-label={status ? `현재 단계: ${DOCUMENT_STATUS_LABELS[status]}` : "미등록"}>
      {DOCUMENT_STATUSES.map((s, i) => {
        const passed = i < current || (i === current && s === "DONE");
        const isCurrent = i === current;
        return (
          <li key={s} className="min-w-0">
            <div className={cn("h-1.5 rounded-full", i <= current ? "bg-primary-500" : "bg-neutral-200")} aria-hidden />
            <p
              className={cn(
                "mt-1 flex items-center gap-0.5 truncate text-xs",
                isCurrent ? "font-semibold text-primary-700" : i < current ? "text-neutral-600" : "text-neutral-400"
              )}
              aria-current={isCurrent ? "step" : undefined}
            >
              {passed && <Check className="size-3 shrink-0" aria-hidden />}
              {DOCUMENT_STATUS_LABELS[s]}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
