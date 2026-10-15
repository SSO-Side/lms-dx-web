import { tryCohortAccess } from "@/lib/access/pageAccess";
import { hasActionPermission } from "@/lib/access/permissions";
import { todayYmd } from "@/lib/dates";
import { AccessDenied } from "@/components/shell/AccessDenied";
import { PageHeader } from "@/components/shell/PageHeader";
import { getCurriculum } from "@/server/curriculum-queries";
import { CurriculumView } from "./curriculum-view";

interface Props {
  params: Promise<{ cohortId: string }>;
  searchParams: Promise<{ week?: string }>;
}

export default async function CurriculumPage({ params, searchParams }: Props) {
  const { cohortId } = await params;
  const sp = await searchParams;
  const ctx = await tryCohortAccess(cohortId, "material:read");
  if (!ctx) return <AccessDenied />;

  const { weeks, enrolledCount } = await getCurriculum(ctx.cohortId, { id: ctx.user.id, role: ctx.role });
  const today = todayYmd();
  // 기본 주차: 오늘 이전의 가장 최근 수업이 있는 주차 → 없으면 첫 주차
  const byLesson = [...weeks].reverse().find((w) => w.lessons.some((l) => l.date <= today));
  const selected = weeks.find((w) => String(w.id) === sp.week) ?? byLesson ?? weeks[0] ?? null;
  const isStudent = ctx.role === "STUDENT";

  return (
    <>
      <PageHeader
        back={{ href: `/app/c/${ctx.cohortId}`, label: "반 홈" }}
        title={isStudent ? "자료·과제" : "수업·자료"}
        description={isStudent ? "주차를 고르면 수업별 자료와 과제가 보입니다." : "주차 → 수업 순서로 자료와 과제를 등록합니다."}
      />
      <CurriculumView
        cohortId={ctx.cohortId}
        weeks={weeks}
        selectedWeekId={selected?.id ?? null}
        canWrite={hasActionPermission(ctx.role, "material:write")}
        isStudent={isStudent}
        enrolledCount={enrolledCount}
        today={today}
      />
    </>
  );
}
