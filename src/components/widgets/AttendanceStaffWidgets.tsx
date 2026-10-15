import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { Widget } from "@/components/Widget";
import { StatusBadge } from "@/components/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import type { StudentAttendance } from "@/server/attendance-queries";

/** 위험·주의 학생 목록 (강사) */
export function RiskStudentsWidget({ cohortId, rows, periodLabel }: { cohortId: number; rows: StudentAttendance[]; periodLabel?: string }) {
  const risky = rows
    .filter((r) => r.result.grade === "DANGER" || r.result.grade === "WARN")
    .sort((a, b) => a.result.remaining - b.result.remaining);
  return (
    <Widget
      title="위험·주의 학생"
      subtitle={periodLabel ? `${periodLabel} · 참고용` : "참고용"}
      empty={risky.length === 0 ? { message: "위험·주의 학생이 없습니다." } : undefined}
    >
      <ul className="-mx-1 divide-y divide-neutral-200">
        {risky.slice(0, 6).map((r) => (
          <li key={r.studentId} className="flex min-h-11 items-center gap-2 px-1 py-1.5">
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900">{r.name}</span>
            <span className="text-xs text-neutral-500 tabular-nums">
              잔여 {r.result.remaining}/{r.result.allowedAbsences}일
            </span>
            <StatusBadge domain="attendance" value={r.result.grade} />
          </li>
        ))}
      </ul>
      <Link
        href={`/app/c/${cohortId}/attendance?tab=roster&grade=RISK`}
        className="mt-2 inline-flex min-h-11 items-center gap-0.5 text-sm text-primary-500 hover:underline"
      >
        출결 명부 보기 <ChevronRight className="size-4" aria-hidden />
      </Link>
    </Widget>
  );
}

/** 위험·주의 요약 (매니저): 클릭 시 명부 카운터 필터 */
export function RiskSummaryWidget({ cohortId, danger, warn, periodLabel }: { cohortId: number; danger: number; warn: number; periodLabel?: string }) {
  const base = `/app/c/${cohortId}/attendance?tab=roster`;
  return (
    <Widget title="위험·주의 요약" subtitle={periodLabel ? `${periodLabel} · 참고용` : "참고용"}>
      <div className="grid grid-cols-2 gap-3">
        <Link href={`${base}&grade=DANGER`} className="rounded-lg bg-status-danger-bg p-3 hover:ring-2 hover:ring-status-danger-solid/40">
          <span className="flex items-center gap-1 text-xs font-medium text-status-danger-fg">
            <StatusBadge domain="attendance" value="DANGER" />
          </span>
          <span className="mt-1 block text-2xl font-semibold text-neutral-900 tabular-nums">{danger}명</span>
        </Link>
        <Link href={`${base}&grade=WARN`} className="rounded-lg bg-status-warning-bg p-3 hover:ring-2 hover:ring-status-warning-solid/40">
          <span className="flex items-center gap-1 text-xs font-medium text-status-warning-fg">
            <StatusBadge domain="attendance" value="WARN" />
          </span>
          <span className="mt-1 block text-2xl font-semibold text-neutral-900 tabular-nums">{warn}명</span>
        </Link>
      </div>
    </Widget>
  );
}

/** 오늘 출결 입력 상태 (매니저) */
export function TodayAttendanceWidget({
  cohortId,
  today,
  isTraining,
  closed,
  unclosedCount,
  lastClosedDate,
}: {
  cohortId: number;
  today: string;
  isTraining: boolean;
  closed: boolean;
  unclosedCount: number;
  lastClosedDate: string | null;
}) {
  return (
    <Widget
      title="오늘 출결 입력"
      subtitle={`최종 반영일: ${lastClosedDate ?? "아직 없음"}`}
      action={
        <Link href={`/app/c/${cohortId}/attendance?tab=today`} className={buttonVariants({ size: "sm" })}>
          오늘 출결 입력
        </Link>
      }
    >
      <div className="space-y-2 text-sm">
        {!isTraining ? (
          <p className="text-neutral-600">오늘({today})은 훈련일이 아닙니다.</p>
        ) : closed ? (
          <p className="flex items-center gap-1.5 text-status-success-fg">
            <CheckCircle2 className="size-4 text-status-success-solid" aria-hidden /> 오늘 출결 확인을 마쳤습니다.
          </p>
        ) : (
          <p className="text-neutral-700">오늘 출결이 아직 확인되지 않았습니다. 예외만 입력하고 확인 완료를 눌러 주세요.</p>
        )}
        {unclosedCount > 0 && (
          <p className="flex items-center gap-1.5 rounded-md bg-status-warning-bg px-2.5 py-2 text-status-warning-fg">
            <AlertTriangle className="size-4 shrink-0 text-status-warning-solid" aria-hidden />
            이번 단위기간에 확인되지 않은 지난 훈련일이 {unclosedCount}일 있습니다.
          </p>
        )}
      </div>
    </Widget>
  );
}

/** 반 현황 (매니저) */
export function CohortStatusWidget({
  enrolled,
  dropped,
  progress,
  period,
}: {
  enrolled: number;
  dropped: number;
  progress: { done: number; total: number };
  period: string;
}) {
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <Widget title="반 현황" subtitle={period}>
      <dl className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-neutral-50 p-3">
          <dt className="text-xs text-neutral-500">재적</dt>
          <dd className="mt-1 text-2xl font-semibold text-neutral-900 tabular-nums">{enrolled}명</dd>
        </div>
        <div className="rounded-lg bg-neutral-50 p-3">
          <dt className="text-xs text-neutral-500">이탈</dt>
          <dd className="mt-1 text-2xl font-semibold text-neutral-900 tabular-nums">{dropped}명</dd>
        </div>
        <div className="rounded-lg bg-neutral-50 p-3">
          <dt className="text-xs text-neutral-500">훈련 진행</dt>
          <dd className="mt-1 text-2xl font-semibold text-neutral-900 tabular-nums">
            {progress.done}
            <span className="text-sm font-medium text-neutral-500">/{progress.total}일</span>
          </dd>
        </div>
      </dl>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="훈련 진행률">
        <div className="h-full rounded-full bg-primary-500" style={{ width: `${pct}%` }} />
      </div>
    </Widget>
  );
}
