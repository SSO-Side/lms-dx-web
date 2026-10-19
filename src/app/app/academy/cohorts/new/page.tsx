// 반 개설 페이지(/app/academy/cohorts/new). 입력 단계는 new-cohort-form.tsx.
import { Role } from "@prisma/client";
import { requireAuthUser } from "@/lib/auth/session";
import { AccessDenied } from "@/components/shell/AccessDenied";
import { PageHeader } from "@/components/shell/PageHeader";
import { db } from "@/lib/db";
import { NewCohortForm } from "./new-cohort-form";

export default async function NewCohortPage() {
  const user = await requireAuthUser();
  if (user.role !== Role.ACADEMY_ADMIN && user.role !== Role.ADMIN) {
    return <AccessDenied />;
  }

  const staffOptions = await db.user.findMany({
    where: {
      ...(user.academyId ? { academyId: user.academyId } : {}),
      role: { in: [Role.MANAGER, Role.INSTRUCTOR] },
      status: "ACTIVE",
    },
    select: { id: true, name: true, loginId: true, role: true },
    orderBy: [{ role: "desc" }, { name: "asc" }],
  });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back={{ href: "/app/academy", label: "학원 홈" }} title="반 개설" description="과정 정보, 일정, 단위기간, 담당자를 등록합니다. 개설 후 명부 등록 화면으로 이동합니다." />
      <div className="rounded-xl border border-neutral-200 bg-card p-5">
        <NewCohortForm staffOptions={staffOptions} />
      </div>
    </div>
  );
}
