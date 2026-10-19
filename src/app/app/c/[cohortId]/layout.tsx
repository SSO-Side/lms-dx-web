// 반 화면(/app/c/[cohortId]/...)의 공통 틀: 반 접근 확인, 역할별 메뉴, 반 전환 드롭다운.
import { notFound } from "next/navigation";
import { Role } from "@prisma/client";
import { requireAuthUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { canAccessCohortPure } from "@/lib/access/checker";
import { AppShell } from "@/components/shell/AppShell";
import { AccessDenied } from "@/components/shell/AccessDenied";
import { cohortNav, ROLE_LABELS } from "@/components/shell/nav";

interface CohortLayoutProps {
  children: React.ReactNode;
  params: Promise<{ cohortId: string }>;
}

export default async function CohortLayout({ children, params }: CohortLayoutProps) {
  const { cohortId } = await params;
  const numCohortId = parseInt(cohortId, 10);
  if (!numCohortId || isNaN(numCohortId)) {
    notFound();
  }

  const user = await requireAuthUser();

  const currentCohort = await db.cohort.findUnique({
    where: { id: numCohortId },
    select: { id: true, name: true, academyId: true, room: true },
  });

  if (!currentCohort) {
    return <AccessDenied />;
  }

  // 사용자의 반 목록 조회 (반 전환 드롭다운용 및 접근 검증)
  let userCohorts: Array<{ id: number; name: string }> = [];
  let isAuthorized = false;

  if (user.role === Role.ADMIN) {
    isAuthorized = true;
    userCohorts = await db.cohort.findMany({
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });
  } else if (user.role === Role.ACADEMY_ADMIN) {
    isAuthorized = user.academyId === currentCohort.academyId;
    if (user.academyId) {
      userCohorts = await db.cohort.findMany({
        where: { academyId: user.academyId },
        select: { id: true, name: true },
        orderBy: { id: "asc" },
      });
    }
  } else if (user.role === Role.STUDENT) {
    const enrollments = await db.enrollment.findMany({
      where: { studentId: user.id, status: "ENROLLED" },
      include: { cohort: { select: { id: true, name: true, academyId: true } } },
    });
    userCohorts = enrollments.map((e) => e.cohort);
    isAuthorized = canAccessCohortPure(user, currentCohort, {
      enrolledCohortIds: enrollments.map((e) => e.cohortId),
      staffCohortIds: [],
    });
  } else {
    // INSTRUCTOR, MANAGER
    const staffList = await db.cohortStaff.findMany({
      where: { userId: user.id },
      include: { cohort: { select: { id: true, name: true, academyId: true } } },
    });
    userCohorts = staffList.map((s) => s.cohort);
    isAuthorized = canAccessCohortPure(user, currentCohort, {
      enrolledCohortIds: [],
      staffCohortIds: staffList.map((s) => s.cohortId),
    });
  }

  if (!isAuthorized) {
    return <AccessDenied />;
  }

  return (
    <AppShell
      title={currentCohort.name}
      subtitle={currentCohort.room ?? undefined}
      nav={cohortNav(user.role, numCohortId)}
      user={{ name: user.name, roleLabel: ROLE_LABELS[user.role] }}
      cohorts={userCohorts}
      currentCohortId={numCohortId}
      studentMode={user.role === Role.STUDENT}
    >
      {children}
    </AppShell>
  );
}
