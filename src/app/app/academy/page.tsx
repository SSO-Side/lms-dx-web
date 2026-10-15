import Link from "next/link";
import { Role, CohortStatus } from "@prisma/client";
import { Plus } from "lucide-react";
import { requireAuthUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import { AccessDenied } from "@/components/shell/AccessDenied";
import { PageHeader } from "@/components/shell/PageHeader";

interface CohortRow {
  id: number;
  name: string;
  room: string | null;
  period: string;
  status: string;
  studentCount: number;
  managerName: string;
}

export default async function AcademyPage() {
  const user = await requireAuthUser();
  if (user.role !== Role.ACADEMY_ADMIN && user.role !== Role.ADMIN) {
    return <AccessDenied />;
  }

  const cohorts = await db.cohort.findMany({
    where: user.academyId ? { academyId: user.academyId } : {},
    include: {
      enrollments: { where: { status: "ENROLLED" }, select: { id: true } },
      staff: { where: { staffRole: "MANAGER" }, include: { user: { select: { name: true } } } },
    },
    orderBy: { id: "desc" },
  });

  const rows: CohortRow[] = cohorts.map((c) => ({
    id: c.id,
    name: c.name,
    room: c.room,
    period: `${formatDate(c.startDate)} ~ ${formatDate(c.endDate)}`,
    status: c.status,
    studentCount: c.enrollments.length,
    managerName: c.staff.map((s) => s.user.name).join(", ") || "미배정",
  }));

  const activeCount = cohorts.filter((c) => c.status === CohortStatus.ACTIVE).length;
  const studentTotal = rows.reduce((sum, r) => sum + r.studentCount, 0);

  const columns: Column<CohortRow>[] = [
    {
      header: "과정명",
      cell: (r) => (
        <Link href={`/app/c/${r.id}`} className="font-medium text-primary-600 hover:underline">
          {r.name}
        </Link>
      ),
    },
    { header: "강의실", cell: (r) => r.room ?? "미정" },
    { header: "훈련 기간", cell: (r) => <span className="tabular-nums">{r.period}</span> },
    { header: "재적", align: "right", cell: (r) => <span className="tabular-nums">{r.studentCount}명</span> },
    { header: "담당 매니저", accessorKey: "managerName" },
    { header: "상태", cell: (r) => <StatusBadge domain="cohortStatus" value={r.status} /> },
    {
      header: <span className="sr-only">관리</span>,
      align: "right",
      cell: (r) => (
        <Link href={`/app/academy/cohorts/${r.id}/accounts`} className={buttonVariants({ variant: "outline", size: "xs" })}>
          계정 관리
        </Link>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="학원 홈"
        description="개설된 반을 확인하고 명부와 계정을 관리합니다."
        actions={
          <Link href="/app/academy/cohorts/new" className={buttonVariants({ size: "sm" })}>
            <Plus aria-hidden />반 개설
          </Link>
        }
      />

      <dl className="mb-5 grid grid-cols-3 gap-3">
        {[
          { label: "전체 반", value: `${cohorts.length}개` },
          { label: "진행 중", value: `${activeCount}개` },
          { label: "재적 수강생", value: `${studentTotal}명` },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-neutral-200 bg-card p-3">
            <dt className="text-xs text-neutral-500">{s.label}</dt>
            <dd className="mt-1 text-xl font-semibold text-neutral-900 tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      <DataTable
        columns={columns}
        data={rows}
        getRowKey={(r) => r.id}
        emptyMessage="아직 개설된 반이 없습니다. 오른쪽 위 [반 개설]로 시작해 주세요."
      />
    </>
  );
}
