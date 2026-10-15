import { Role } from "@prisma/client";
import { requireAuthUser } from "@/lib/auth/session";
import { AccessDenied } from "@/components/shell/AccessDenied";
import { PageHeader } from "@/components/shell/PageHeader";
import { NewCohortForm } from "./new-cohort-form";

export default async function NewCohortPage() {
  const user = await requireAuthUser();
  if (user.role !== Role.ACADEMY_ADMIN && user.role !== Role.ADMIN) {
    return <AccessDenied />;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="반 개설" description="과정 정보와 훈련 기간을 등록합니다. 개설 후 명부 등록 화면으로 이동합니다." />
      <div className="rounded-xl border border-neutral-200 bg-card p-5">
        <NewCohortForm />
      </div>
    </div>
  );
}
