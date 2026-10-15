import { Role, EnrollmentStatus } from "@prisma/client";
import { requireCohortAccess } from "@/lib/access/requireCohortAccess";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { Widget } from "@/components/Widget";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/shell/PageHeader";

interface CohortHomePageProps {
  params: Promise<{ cohortId: string }>;
}

// 위젯 구성은 screens.md §1. 데이터는 M3(출결)·M2(티켓)·M1(과제) 모듈에서 연결한다.
const SOON = (module: string) => ({ message: `${module} 모듈이 연결되면 여기에 표시됩니다.` });

export default async function CohortHomePage({ params }: CohortHomePageProps) {
  const { cohortId } = await params;
  const ctx = await requireCohortAccess(cohortId, "material:read");

  const cohort = await db.cohort.findUnique({
    where: { id: ctx.cohortId },
    select: { name: true, trainingType: true, room: true, startDate: true, endDate: true, status: true },
  });
  if (!cohort) return null;

  const period = `${formatDate(cohort.startDate)} ~ ${formatDate(cohort.endDate)}`;
  const header = (
    <PageHeader
      title={cohort.name}
      description={[cohort.trainingType, cohort.room ?? "강의실 미정", period].filter(Boolean).join(" · ")}
      actions={<StatusBadge domain="cohortStatus" value={cohort.status} />}
    />
  );

  if (ctx.role === Role.STUDENT) {
    return (
      <>
        {header}
        <div className="grid gap-4 md:grid-cols-2">
          <Widget title="내 출결" subtitle="참고용" density="comfortable" empty={SOON("출결")} />
          <Widget title="내 티켓" density="comfortable" empty={SOON("티켓·결석계")} />
          <Widget title="마감 임박 과제" density="comfortable" empty={SOON("커리큘럼·과제")} />
          <Widget title="오늘 수업" density="comfortable" empty={SOON("커리큘럼·과제")} />
        </div>
      </>
    );
  }

  if (ctx.role === Role.INSTRUCTOR) {
    return (
      <>
        {header}
        <div className="grid gap-4 lg:grid-cols-2">
          <Widget title="위험·주의 학생" empty={SOON("출결")} />
          <Widget title="처리 대기 티켓" empty={SOON("티켓·결석계")} />
          <Widget title="최근 과제 제출" empty={SOON("커리큘럼·과제")} />
          <Widget title="오늘 수업·자료" empty={SOON("커리큘럼·과제")} />
        </div>
      </>
    );
  }

  // MANAGER, ACADEMY_ADMIN, ADMIN
  const enrollmentCounts = await db.enrollment.groupBy({
    by: ["status"],
    where: { cohortId: ctx.cohortId },
    _count: { _all: true },
  });
  const countOf = (s: EnrollmentStatus) => enrollmentCounts.find((e) => e.status === s)?._count._all ?? 0;
  const enrolled = countOf(EnrollmentStatus.ENROLLED);
  const dropped = countOf(EnrollmentStatus.DROPPED);

  return (
    <>
      {header}
      <div className="grid gap-4 lg:grid-cols-2">
        <Widget title="오늘 출결 입력" empty={SOON("출결")} />
        <Widget title="위험·주의 요약" empty={SOON("출결")} />
        <Widget title="처리 대기 티켓" empty={SOON("티켓·결석계")} />
        <Widget title="반 현황" subtitle={period}>
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-neutral-50 p-3">
              <dt className="text-xs text-neutral-500">재적</dt>
              <dd className="mt-1 text-2xl font-semibold text-neutral-900 tabular-nums">{enrolled}명</dd>
            </div>
            <div className="rounded-lg bg-neutral-50 p-3">
              <dt className="text-xs text-neutral-500">이탈</dt>
              <dd className="mt-1 text-2xl font-semibold text-neutral-900 tabular-nums">{dropped}명</dd>
            </div>
          </dl>
        </Widget>
      </div>
    </>
  );
}
