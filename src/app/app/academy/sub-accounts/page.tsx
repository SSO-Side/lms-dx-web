// 서브 계정 페이지: 슈퍼어드민이 학원의 서브 관리자 계정을 발급·재설정·비활성화한다.
import { requireAuthUser } from "@/lib/auth/session";
import { canManageSubAccountsPure } from "@/lib/access/checker";
import { formatDateTime } from "@/lib/dates";
import { listSubAccounts } from "@/server/academy-queries";
import { PageHeader } from "@/components/shell/PageHeader";
import { Widget } from "@/components/Widget";
import { SubAccountsManager } from "./sub-accounts-manager";

export default async function SubAccountsPage() {
  const user = await requireAuthUser();
  const header = (
    <PageHeader
      back={{ href: "/app/academy", label: "학원 홈" }}
      title="서브 계정"
      description="서브 관리자는 학원의 모든 반을 보고 출결·티켓·반 운영·수강생과 강사 계정을 관리합니다."
    />
  );
  if (!canManageSubAccountsPure(user)) {
    return (
      <>
        {header}
        <Widget title="서브 계정" empty={{ message: "학원 슈퍼어드민 계정으로 관리할 수 있습니다." }} />
      </>
    );
  }

  const rows = await listSubAccounts(user.academyId);
  return (
    <>
      {header}
      <SubAccountsManager
        accounts={rows.map((r) => ({
          id: r.id,
          name: r.name,
          loginId: r.loginId,
          phone: r.phone,
          status: r.status,
          lastLoginAt: r.lastLoginAt ? formatDateTime(r.lastLoginAt) : null,
          cohortCount: r.cohortCount,
          primaryCount: r.primaryCount,
        }))}
      />
    </>
  );
}
