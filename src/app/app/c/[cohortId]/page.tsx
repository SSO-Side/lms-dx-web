import Link from "next/link";
import { Role, EnrollmentStatus } from "@prisma/client";
import { FilePlus2 } from "lucide-react";
import { tryCohortAccess } from "@/lib/access/pageAccess";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { todayYmd } from "@/lib/dates";
import { Widget } from "@/components/Widget";
import { StatusBadge } from "@/components/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import { AccessDenied } from "@/components/shell/AccessDenied";
import { PageHeader } from "@/components/shell/PageHeader";
import { AttendanceSummaryWidget } from "@/components/widgets/AttendanceSummaryWidget";
import { TicketListWidget } from "@/components/widgets/TicketListWidget";
import { TodayLessonWidget, AssignmentDueWidget, SubmissionFeedWidget } from "@/components/widgets/LessonWidgets";
import {
  RiskStudentsWidget,
  RiskSummaryWidget,
  TodayAttendanceWidget,
  CohortStatusWidget,
} from "@/components/widgets/AttendanceStaffWidgets";
import { getAttendanceBase, computePeriodAttendance } from "@/server/attendance-queries";
import { listTickets } from "@/server/ticket-queries";
import { getTodayLessons, getDueAssignments, getRecentSubmissions } from "@/server/curriculum-queries";
import { getCohortSummary, trainingProgress } from "@/server/dashboard-queries";
import { listMyDocuments, getCohortDocumentStatus } from "@/server/document-queries";
import { MyDocumentsWidget, DocumentStatusWidget } from "@/components/widgets/DocumentWidgets";
import { getMyTeam, getTeamStatusSummary } from "@/server/team-queries";
import { MyTeamProjectWidget, TeamStatusWidget } from "@/components/widgets/TeamWidgets";
import { NewLeadsWidget } from "@/components/widgets/LeadWidget";
import { listLeads, countNewLeads } from "@/server/lead-queries";
import { hasActionPermission } from "@/lib/access/permissions";

interface CohortHomePageProps {
  params: Promise<{ cohortId: string }>;
}

const LOAD_ERROR = "불러오지 못했습니다. 잠시 후 새로고침해 주세요.";

/** 위젯 단위 오류 격리: 하나가 실패해도 화면 전체를 막지 않는다 (ia.md §4). */
async function safe<T>(p: Promise<T>): Promise<{ ok: true; data: T } | { ok: false }> {
  try {
    return { ok: true, data: await p };
  } catch (e) {
    console.error("[widget]", e);
    return { ok: false };
  }
}

export default async function CohortHomePage({ params }: CohortHomePageProps) {
  const { cohortId } = await params;
  const ctx = await tryCohortAccess(cohortId, "material:read");
  if (!ctx) return <AccessDenied />;
  const id = ctx.cohortId;

  const cohort = await db.cohort.findUnique({
    where: { id },
    select: { name: true, trainingType: true, room: true, startDate: true, endDate: true, status: true },
  });
  if (!cohort) return <AccessDenied />;

  const period = `${formatDate(cohort.startDate)} ~ ${formatDate(cohort.endDate)}`;
  // 상위 화면: 학원 관리자는 학원 홈, 여러 반을 맡은 교사는 담당 반 목록
  const back =
    ctx.role === Role.ACADEMY_ADMIN || ctx.role === Role.ADMIN
      ? { href: "/app/academy", label: "학원 홈" }
      : (ctx.role === Role.INSTRUCTOR || ctx.role === Role.MANAGER) &&
          (await db.cohortStaff.count({ where: { userId: ctx.user.id } })) > 1
        ? { href: "/app/overview", label: "담당 반" }
        : undefined;
  const header = (
    <PageHeader
      back={back}
      title={cohort.name}
      description={[cohort.trainingType, cohort.room ?? "강의실 미정", period].filter(Boolean).join(" · ")}
      actions={<StatusBadge domain="cohortStatus" value={cohort.status} />}
    />
  );
  const baseRes = await safe(getAttendanceBase(id));
  const base = baseRes.ok ? baseRes.data : null;
  const today = base?.today ?? todayYmd();
  const now = new Date();

  if (ctx.role === Role.STUDENT) {
    const [mine, tickets, due, lessons, docs, team] = await Promise.all([
      safe(base?.currentPeriod ? computePeriodAttendance(id, base, base.currentPeriod, ctx.user.id) : Promise.resolve([])),
      safe(listTickets(id, { requesterId: ctx.user.id, statuses: ["PENDING", "IN_REVIEW", "NEEDS_REVISION"], take: 3 })),
      safe(getDueAssignments(id, ctx.user.id, now)),
      safe(getTodayLessons(id, today)),
      safe(listMyDocuments(id, ctx.user.id)),
      safe(getMyTeam(id, ctx.user.id, today)),
    ]);
    return (
      <>
        {header}
        <div className="grid gap-4 md:grid-cols-2">
          <AttendanceSummaryWidget
            result={mine.ok ? mine.data[0]?.result ?? null : null}
            periodLabel={base?.currentPeriod?.label}
            lastClosedDate={base?.lastClosedDate ?? null}
            excusedLimit={base?.config.excused.limit ?? null}
            href={`/app/c/${id}/attendance`}
            error={!mine.ok || !base ? LOAD_ERROR : undefined}
          />
          {tickets.ok ? (
            <TicketListWidget
              cohortId={id}
              title="내 티켓"
              tickets={tickets.data}
              emptyMessage="진행 중인 티켓이 없습니다."
              moreHref={`/app/c/${id}/tickets`}
              action={
                <Link href={`/app/c/${id}/tickets?new=absence`} className={buttonVariants({ size: "sm" })}>
                  <FilePlus2 aria-hidden /> 병결·휴가 신청
                </Link>
              }
            />
          ) : (
            <Widget title="내 티켓" error={LOAD_ERROR} />
          )}
          {due.ok ? <AssignmentDueWidget cohortId={id} items={due.data} now={now} /> : <Widget title="마감 임박 과제" error={LOAD_ERROR} />}
          {lessons.ok ? <TodayLessonWidget cohortId={id} lessons={lessons.data} /> : <Widget title="오늘 수업" error={LOAD_ERROR} />}
          {docs.ok ? <MyDocumentsWidget cohortId={id} documents={docs.data} /> : <Widget title="내 서류" error={LOAD_ERROR} />}
          {team.ok ? <MyTeamProjectWidget cohortId={id} team={team.data} /> : <Widget title="내 팀 프로젝트" error={LOAD_ERROR} />}
        </div>
      </>
    );
  }

  const pendingTickets = safe(listTickets(id, { statuses: ["PENDING", "IN_REVIEW"], take: 5 }));
  const docStatus = safe(getCohortDocumentStatus(id));
  const docWidget = (r: Awaited<typeof docStatus>, forInstructor: boolean) =>
    r.ok ? (
      <DocumentStatusWidget cohortId={id} stages={r.data.stages} total={r.data.rows.length} forInstructor={forInstructor} />
    ) : (
      <Widget title="서류 현황" error={LOAD_ERROR} />
    );
  const teamStatus = safe(getTeamStatusSummary(id, today));
  const teamWidget = (r: Awaited<typeof teamStatus>) =>
    r.ok ? <TeamStatusWidget cohortId={id} summary={r.data} /> : <Widget title="팀 현황" error={LOAD_ERROR} />;

  if (ctx.role === Role.INSTRUCTOR) {
    const [rows, tickets, subs, lessons, docs, teams] = await Promise.all([
      safe(base?.currentPeriod ? computePeriodAttendance(id, base, base.currentPeriod) : Promise.resolve([])),
      pendingTickets,
      safe(getRecentSubmissions(id)),
      safe(getTodayLessons(id, today)),
      docStatus,
      teamStatus,
    ]);
    return (
      <>
        {header}
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.ok && base ? (
            <RiskStudentsWidget cohortId={id} rows={rows.data} periodLabel={base.currentPeriod?.label} />
          ) : (
            <Widget title="위험·주의 학생" error={LOAD_ERROR} />
          )}
          {tickets.ok ? (
            <TicketListWidget cohortId={id} title="처리 대기 티켓" tickets={tickets.data} showRequester emptyMessage="처리할 티켓이 없습니다." moreHref={`/app/c/${id}/tickets`} />
          ) : (
            <Widget title="처리 대기 티켓" error={LOAD_ERROR} />
          )}
          {subs.ok ? <SubmissionFeedWidget cohortId={id} items={subs.data} /> : <Widget title="최근 과제 제출" error={LOAD_ERROR} />}
          {lessons.ok ? <TodayLessonWidget cohortId={id} title="오늘 수업·자료" lessons={lessons.data} /> : <Widget title="오늘 수업·자료" error={LOAD_ERROR} />}
          {docWidget(docs, true)}
          {teamWidget(teams)}
        </div>
      </>
    );
  }

  // MANAGER, ACADEMY_ADMIN, ADMIN
  const canReadLeads = hasActionPermission(ctx.role, "lead:read");
  const [summary, tickets, counts, docs, teams, leads] = await Promise.all([
    safe(base ? getCohortSummary(id, base) : Promise.reject(new Error("no base"))),
    pendingTickets,
    safe(db.enrollment.groupBy({ by: ["status"], where: { cohortId: id }, _count: { _all: true } })),
    docStatus,
    teamStatus,
    safe(canReadLeads ? Promise.all([listLeads(id, { take: 3, now }), countNewLeads(id, now)]) : Promise.resolve(null)),
  ]);
  const countOf = (s: EnrollmentStatus) => (counts.ok ? counts.data.find((e) => e.status === s)?._count._all ?? 0 : 0);

  return (
    <>
      {header}
      <div className="grid gap-4 lg:grid-cols-2">
        {summary.ok && base ? (
          <TodayAttendanceWidget
            cohortId={id}
            today={today}
            isTraining={summary.data.todayIsTraining}
            closed={summary.data.todayClosed}
            unclosedCount={summary.data.unclosedCount}
            lastClosedDate={base.lastClosedDate}
          />
        ) : (
          <Widget title="오늘 출결 입력" error={LOAD_ERROR} />
        )}
        {summary.ok ? (
          <RiskSummaryWidget cohortId={id} danger={summary.data.danger} warn={summary.data.warn} periodLabel={base?.currentPeriod?.label} />
        ) : (
          <Widget title="위험·주의 요약" error={LOAD_ERROR} />
        )}
        {tickets.ok ? (
          <TicketListWidget cohortId={id} title="처리 대기 티켓" tickets={tickets.data} showRequester emptyMessage="처리할 티켓이 없습니다." moreHref={`/app/c/${id}/tickets`} />
        ) : (
          <Widget title="처리 대기 티켓" error={LOAD_ERROR} />
        )}
        {counts.ok && base ? (
          <CohortStatusWidget
            enrolled={countOf(EnrollmentStatus.ENROLLED)}
            dropped={countOf(EnrollmentStatus.DROPPED)}
            progress={trainingProgress(base)}
            period={period}
          />
        ) : (
          <Widget title="반 현황" error={LOAD_ERROR} />
        )}
        {docWidget(docs, false)}
        {teamWidget(teams)}
        {canReadLeads &&
          (leads.ok && leads.data ? (
            <NewLeadsWidget cohortId={id} leads={leads.data[0]} newCount={leads.data[1]} />
          ) : (
            <Widget title="신규 문의" error={LOAD_ERROR} />
          ))}
      </div>
    </>
  );
}
