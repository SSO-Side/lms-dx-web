// 출결 페이지: 수강생은 내 출결, 매니저·강사는 날짜별 출결표와 명부 카운터.
import Link from "next/link";
import { Role } from "@prisma/client";
import { requireAuthUser } from "@/lib/auth/session";
import { tryCohortAccess } from "@/lib/access/pageAccess";
import { db } from "@/lib/db";
import { isYmd, formatYmdWithDow } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { AccessDenied } from "@/components/shell/AccessDenied";
import { PageHeader } from "@/components/shell/PageHeader";
import { AttendanceBanner } from "@/components/attendance/AttendanceBanner";
import { AttendanceSummaryWidget } from "@/components/widgets/AttendanceSummaryWidget";
import { StatusBadge } from "@/components/StatusBadge";
import { Widget } from "@/components/Widget";
import { EXCUSED_LABELS } from "@/lib/attendance/labels";
import {
  getAttendanceBase,
  computePeriodAttendance,
  getDaySheet,
  getStudentEvents,
} from "@/server/attendance-queries";
import { DaySheet } from "./day-sheet";
import { RosterCounter } from "./roster-counter";

interface Props {
  params: Promise<{ cohortId: string }>;
  searchParams: Promise<{ tab?: string; date?: string; period?: string; grade?: string }>;
}

export default async function AttendancePage({ params, searchParams }: Props) {
  const { cohortId } = await params;
  const sp = await searchParams;
  const user = await requireAuthUser();

  if (user.role === Role.STUDENT) {
    const ctx = await tryCohortAccess(cohortId, "attendance:readOwn");
    if (!ctx) return <AccessDenied />;
    return <StudentView cohortId={ctx.cohortId} studentId={ctx.user.id} periodParam={sp.period} />;
  }

  const ctx = await tryCohortAccess(cohortId, "attendance:readCohort");
  if (!ctx) return <AccessDenied />;
  const canWrite = ctx.role !== Role.INSTRUCTOR;

  const base = await getAttendanceBase(ctx.cohortId);
  const period = base.periods.find((p) => String(p.id) === sp.period) ?? base.currentPeriod;
  const tab = canWrite && sp.tab !== "roster" ? "today" : "roster";
  const basePath = `/app/c/${ctx.cohortId}/attendance`;

  const header = (
    <PageHeader
      title="출결"
      back={{ href: `/app/c/${ctx.cohortId}`, label: "반 홈" }}
      description={canWrite ? "예외만 입력하면 잔여 허용 결석일이 자동으로 계산됩니다." : "담당 반의 출결 현황 (열람 전용)"}
    />
  );

  if (!period) {
    return (
      <>
        {header}
        <Widget title="출결" empty={{ message: "아직 훈련 일정과 단위기간이 없습니다. 반 설정에서 일정을 먼저 등록해 주세요." }} />
      </>
    );
  }

  const tabs = canWrite && (
    <nav className="mb-4 flex gap-1 border-b border-neutral-200" aria-label="출결 보기">
      {[
        { key: "today", label: "오늘 출결" },
        { key: "roster", label: "명부 카운터" },
      ].map((t) => (
        <Link
          key={t.key}
          href={`${basePath}?tab=${t.key}`}
          aria-current={tab === t.key ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
            tab === t.key ? "border-primary-500 text-primary-700" : "border-transparent text-neutral-500 hover:text-neutral-900"
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );

  if (tab === "today") {
    const trainingDates = base.days.filter((d) => d.isTraining).map((d) => d.date);
    const requested = isYmd(sp.date) ? sp.date : base.today;
    // 훈련일이 아니면 그 이전 마지막 훈련일로 (없으면 첫 훈련일)
    const date =
      trainingDates.includes(requested)
        ? requested
        : [...trainingDates].reverse().find((d) => d < requested) ?? trainingDates[0] ?? requested;
    const entries = trainingDates.length ? await getDaySheet(ctx.cohortId, date) : [];

    return (
      <>
        {header}
        {tabs}
        <AttendanceBanner lastClosedDate={base.lastClosedDate} unclosedDates={base.unclosedDates} />
        <DaySheet
          cohortId={ctx.cohortId}
          date={date}
          dateLabel={formatYmdWithDow(date)}
          isClosed={base.closedDates.has(date)}
          trainingDates={trainingDates}
          entries={entries}
          notTrainingDay={requested !== date ? requested : null}
        />
      </>
    );
  }

  const rows = await computePeriodAttendance(ctx.cohortId, base, period);
  const openingCount = await db.attendanceOpening.count({ where: { cohortId: ctx.cohortId } });

  return (
    <>
      {header}
      {tabs}
      <AttendanceBanner lastClosedDate={base.lastClosedDate} unclosedDates={base.unclosedDates} />
      <RosterCounter
        cohortId={ctx.cohortId}
        canWrite={canWrite}
        periods={base.periods.map((p) => ({ id: p.id, label: p.label, startDate: p.startDate, endDate: p.endDate }))}
        period={period}
        rows={rows}
        excusedLimit={base.config.excused.limit}
        defaultGrade={sp.grade ?? (canWrite ? "ALL" : "RISK")}
        canOpen={canWrite && openingCount === 0}
        trainingDates={base.days.filter((d) => d.isTraining).map((d) => d.date)}
        today={base.today}
      />
    </>
  );
}

async function StudentView({ cohortId, studentId, periodParam }: { cohortId: number; studentId: number; periodParam?: string }) {
  const base = await getAttendanceBase(cohortId);
  const period = base.periods.find((p) => String(p.id) === periodParam) ?? base.currentPeriod;
  const [mine] = period ? await computePeriodAttendance(cohortId, base, period, studentId) : [];
  const events = period ? await getStudentEvents(cohortId, studentId, period) : [];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back={{ href: `/app/c/${cohortId}`, label: "반 홈" }} title="내 출결" description="입력·수정은 담당 매니저가 합니다. 이상이 있으면 티켓으로 문의해 주세요." />
      <AttendanceBanner lastClosedDate={base.lastClosedDate} unclosedDates={[]} />
      <div className="space-y-4">
        <AttendanceSummaryWidget
          result={mine?.result ?? null}
          periodLabel={period?.label}
          lastClosedDate={base.lastClosedDate}
          excusedLimit={base.config.excused.limit}
        />

        {base.periods.length > 0 && (
          <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" aria-label="단위기간">
            {base.periods.map((p) => (
              <Link
                key={p.id}
                href={`/app/c/${cohortId}/attendance?period=${p.id}`}
                aria-current={p.id === period?.id ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm",
                  p.id === period?.id ? "border-primary-500 bg-primary-50 font-medium text-primary-700" : "border-neutral-200 text-neutral-600"
                )}
              >
                {p.label}
              </Link>
            ))}
          </nav>
        )}

        <Widget
          title="일자별 기록"
          subtitle={period ? `${period.startDate} ~ ${period.endDate} · 훈련일 ${period.trainingDays}일` : undefined}
          density="comfortable"
          empty={events.length === 0 ? { message: "이 단위기간에는 결석·지각·조퇴 기록이 없습니다." } : undefined}
        >
          <ul className="divide-y divide-neutral-200">
            {events.map((e) => (
              <li key={e.id} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm">
                <span className="tabular-nums text-neutral-700">{formatYmdWithDow(e.date)}</span>
                <span className="flex items-center gap-1.5">
                  <StatusBadge domain="attendanceEvent" value={e.type} />
                  {e.excused && e.excusedType && (
                    <StatusBadge domain="attendanceEvent" value="EXCUSED" label={`공결·${EXCUSED_LABELS[e.excusedType]}`} />
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Widget>
      </div>
    </div>
  );
}
