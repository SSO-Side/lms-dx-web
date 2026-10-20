// 반 화면(/app/c/[cohortId]/...)의 공통 틀: 반 접근 확인, 역할별 메뉴, 반 전환 드롭다운.
import { notFound } from "next/navigation";
import { Role } from "@prisma/client";
import { requireAuthUser } from "@/lib/auth/session";
import { getCohortShell } from "@/server/shell-queries";
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

  const shell = await getCohortShell(user, numCohortId);
  if (!shell) {
    return <AccessDenied />;
  }
  const { cohort: currentCohort, cohorts: userCohorts } = shell;

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
