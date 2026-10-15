import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCohortAccess } from "@/lib/access/requireCohortAccess";
import { db } from "@/lib/db";
import { AccountsManager } from "./accounts-manager";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/shell/PageHeader";

interface AccountsPageProps {
  params: Promise<{ cohortId: string }>;
}

export default async function AccountsPage({ params }: AccountsPageProps) {
  const { cohortId } = await params;
  const numCohortId = parseInt(cohortId, 10);
  if (!numCohortId || isNaN(numCohortId)) {
    notFound();
  }

  const ctx = await requireCohortAccess(numCohortId, "account:manage");

  const cohort = await db.cohort.findUnique({
    where: { id: ctx.cohortId },
    select: { id: true, name: true },
  });

  if (!cohort) {
    notFound();
  }

  // 등록된 수강생 조회
  const enrollments = await db.enrollment.findMany({
    where: { cohortId: ctx.cohortId },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          loginId: true,
          phone: true,
          role: true,
          status: true,
        },
      },
    },
    orderBy: { student: { name: "asc" } },
  });

  // 배정된 강사/매니저 조회
  const staffList = await db.cohortStaff.findMany({
    where: { cohortId: ctx.cohortId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          loginId: true,
          phone: true,
          role: true,
          status: true,
        },
      },
    },
    orderBy: { user: { name: "asc" } },
  });

  const members = [
    ...staffList.map((s) => s.user),
    ...enrollments.map((e) => e.student),
  ];

  return (
    <>
      <PageHeader
        back={{ href: "/app/academy", label: "학원 홈" }}
        title="계정 관리"
        description={`${cohort.name} · 명부 CSV로 계정을 발급하고 비밀번호와 계정 상태를 관리합니다.`}
        actions={
          <Link href={`/app/c/${cohort.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            반 홈으로
          </Link>
        }
      />
      <AccountsManager cohortId={cohort.id} initialMembers={members} />
    </>
  );
}
