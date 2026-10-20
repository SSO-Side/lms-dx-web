// 반 계정 관리 페이지: 수강생·교직원 목록과 CSV 일괄 발급(account:manage 권한).
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCohortAccess } from "@/lib/access/requireCohortAccess";
import { getCohortAccounts } from "@/server/academy-queries";
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

  const accounts = await getCohortAccounts(ctx.cohortId);
  if (!accounts) {
    notFound();
  }
  const { cohort, members } = accounts;

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
