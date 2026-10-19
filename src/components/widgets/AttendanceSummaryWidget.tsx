// 홈 위젯: 수강생 "내 출결" 요약(잔여 허용 결석, 환산 결석).
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Widget } from "@/components/Widget";
import { StatusBadge } from "@/components/StatusBadge";
import type { AttendanceResult } from "@/lib/attendance/compute";

export interface AttendanceSummaryWidgetProps {
  result: AttendanceResult | null;
  periodLabel?: string;
  lastClosedDate: string | null;
  excusedLimit: number | null;
  href?: string;
  error?: string;
}

/** screens.md §1 수강생 "내 출결" 위젯. */
export function AttendanceSummaryWidget({ result, periodLabel, lastClosedDate, excusedLimit, href, error }: AttendanceSummaryWidgetProps) {
  return (
    <Widget
      title="내 출결"
      subtitle={`참고용 · 최종 반영일: ${lastClosedDate ?? "아직 없음"}`}
      density="comfortable"
      error={error}
      empty={!error && !result ? { message: "아직 출결 정보가 없습니다." } : undefined}
      action={
        href ? (
          <Link href={href} className="inline-flex min-h-11 items-center gap-0.5 text-sm text-primary-500 hover:underline">
            자세히 <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : undefined
      }
    >
      {result && (
        <div className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs text-neutral-500">{periodLabel ? `${periodLabel} ` : ""}잔여 허용 결석</p>
              <p className="mt-1 text-4xl font-semibold text-neutral-900 tabular-nums">
                {result.remaining}
                <span className="ml-1 text-base font-medium text-neutral-500">/ {result.allowedAbsences}일</span>
              </p>
            </div>
            <StatusBadge domain="attendance" value={result.grade} />
          </div>
          <dl className="grid grid-cols-4 gap-2 text-center">
            {[
              ["결석", result.counts.absent],
              ["지각", result.counts.late],
              ["조퇴", result.counts.earlyLeave],
              ["병결·휴가", excusedLimit === null ? `${result.excusedUsed}` : `${result.excusedUsed}/${excusedLimit}`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-neutral-50 px-1 py-2">
                <dt className="text-xs text-neutral-500">{k}</dt>
                <dd className="mt-0.5 text-lg font-semibold text-neutral-900 tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-neutral-500">환산 결석 {result.convertedAbsences}일 (지각·조퇴 누적 환산 포함)</p>
        </div>
      )}
    </Widget>
  );
}
