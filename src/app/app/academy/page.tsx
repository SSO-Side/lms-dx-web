// 학원 홈(/app/academy): 학원 전체 대시보드 — 전체 요약 숫자, 모든 반의 처리 대기 티켓·위험 학생, 반별 현황 표.
// 슈퍼어드민·서브 관리자·시스템 관리자. 반 하나가 아니라 학원의 모든 반을 한 화면에서 본다.
import Link from "next/link";
import { CohortStatus } from "@prisma/client";
import { Plus } from "lucide-react";
import { requireAuthUser } from "@/lib/auth/session";
import { isAcademyStaffRole } from "@/lib/access/checker";
import { listAcademyCohorts } from "@/server/academy-queries";
import { getAcademyDashboard, listAcademyPendingTickets, type CohortSummary } from "@/server/dashboard-queries";
import { formatDate } from "@/lib/utils";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Widget } from "@/components/Widget";
import { buttonVariants } from "@/components/ui/button";
import { AccessDenied } from "@/components/shell/AccessDenied";
import { PageHeader } from "@/components/shell/PageHeader";
import { AcademyPendingTicketsWidget, AcademyRiskStudentsWidget } from "@/components/widgets/AcademyWidgets";

interface CohortRow {
  id: number;
  name: string;
  room: string | null;
  period: string;
  status: string;
  studentCount: number;
  primaryName: string;
  summary: CohortSummary | null;
}

export default async function AcademyPage() {
  const user = await requireAuthUser();
  if (!isAcademyStaffRole(user.role)) {
    return <AccessDenied />;
  }

  const cohorts = await listAcademyCohorts(user.academyId);
  const activeCohorts = cohorts.filter((c) => c.status === CohortStatus.ACTIVE);

  // 위젯 단위 오류 격리: 반별 요약은 반마다, 티켓 목록은 따로 실패를 처리한다
  const [dashboard, pendingTickets] = await Promise.all([
    getAcademyDashboard(activeCohorts.map((c) => ({ id: c.id, name: c.name }))).catch(() => null),
    listAcademyPendingTickets(activeCohorts.map((c) => c.id)).catch(() => null),
  ]);
  const summaryById = new Map(dashboard?.summaries.map((s) => [s.cohortId, s.summary]) ?? []);

  const rows: CohortRow[] = cohorts.map((c) => ({
    id: c.id,
    name: c.name,
    room: c.room,
    period: `${formatDate(c.startDate)} ~ ${formatDate(c.endDate)}`,
    status: c.status,
    studentCount: c.enrollments.length,
    primaryName: c.staff.find((s) => s.isPrimary)?.user.name ?? "미지정",
    summary: summaryById.get(c.id) ?? null,
  }));

  const loaded = rows.filter((r) => r.status === CohortStatus.ACTIVE && r.summary).map((r) => r.summary!);
  const studentTotal = rows.filter((r) => r.status === CohortStatus.ACTIVE).reduce((sum, r) => sum + r.studentCount, 0);
  const kpis = [
    { label: "운영 중인 반", value: `${activeCohorts.length}개`, hint: `전체 ${cohorts.length}개` },
    { label: "재적 수강생", value: `${studentTotal}명`, hint: "운영 중인 반" },
    { label: "위험 · 주의", value: `${sum(loaded, "danger")} · ${sum(loaded, "warn")}명`, hint: "현재 단위기간", alert: sum(loaded, "danger") > 0 },
    { label: "처리 대기 티켓", value: `${sum(loaded, "pendingTickets")}건`, hint: "대기·검토 중" },
    {
      label: "오늘 출결 미확인",
      value: `${loaded.filter((s) => s.todayIsTraining && !s.todayClosed).length}개 반`,
      hint: `오늘 훈련 ${loaded.filter((s) => s.todayIsTraining).length}개 반 중`,
      alert: loaded.some((s) => s.todayIsTraining && !s.todayClosed),
    },
  ];
  const failedCount = activeCohorts.length - loaded.length;

  const columns: Column<CohortRow>[] = [
    {
      header: "과정명",
      cell: (r) => (
        <Link href={`/app/c/${r.id}`} className="font-medium text-primary-600 hover:underline">
          {r.name}
        </Link>
      ),
    },
    { header: "훈련 기간", cell: (r) => <span className="whitespace-nowrap tabular-nums">{r.period}</span> },
    { header: "재적", align: "right", cell: (r) => <span className="tabular-nums">{r.studentCount}명</span> },
    {
      header: "위험·주의",
      cell: (r) =>
        r.summary ? (
          <Link href={`/app/c/${r.id}/attendance?tab=roster&grade=RISK`} className="inline-flex gap-1 hover:underline">
            <StatusBadge domain="attendance" value="DANGER" label={`${r.summary.danger}`} />
            <StatusBadge domain="attendance" value="WARN" label={`${r.summary.warn}`} />
          </Link>
        ) : (
          "—"
        ),
    },
    {
      header: "대기 티켓",
      align: "right",
      cell: (r) =>
        r.summary ? (
          <Link href={`/app/c/${r.id}/tickets`} className="tabular-nums hover:underline">
            {r.summary.pendingTickets}건
          </Link>
        ) : (
          "—"
        ),
    },
    {
      header: "오늘 출결",
      cell: (r) =>
        !r.summary ? (
          "—"
        ) : !r.summary.todayIsTraining ? (
          <span className="text-neutral-500">훈련일 아님</span>
        ) : (
          <Link href={`/app/c/${r.id}/attendance`} className="hover:underline">
            <StatusBadge
              domain="attendance"
              value={r.summary.todayClosed ? "NORMAL" : "WARN"}
              label={r.summary.todayClosed ? "확인" : "미확인"}
            />
          </Link>
        ),
    },
    { header: "주담당", accessorKey: "primaryName" },
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
        description="학원의 모든 반을 한 화면에서 봅니다. 반 이름을 누르면 그 반의 홈으로 이동합니다."
        actions={
          <Link href="/app/academy/cohorts/new" className={buttonVariants({ size: "sm" })}>
            <Plus aria-hidden />반 개설
          </Link>
        }
      />

      <dl className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-neutral-200 bg-card p-3">
            <dt className="text-xs text-neutral-500">{k.label}</dt>
            <dd className={k.alert ? "mt-1 text-xl font-semibold text-status-danger-fg tabular-nums" : "mt-1 text-xl font-semibold text-neutral-900 tabular-nums"}>
              {k.value}
            </dd>
            <dd className="mt-0.5 text-xs text-neutral-500">{k.hint}</dd>
          </div>
        ))}
      </dl>
      {failedCount > 0 && <p className="-mt-3 mb-5 text-xs text-status-danger-fg">{failedCount}개 반의 요약을 불러오지 못해 합계에서 뺐습니다.</p>}

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <AcademyPendingTicketsWidget tickets={pendingTickets} total={sum(loaded, "pendingTickets")} />
        <AcademyRiskStudentsWidget rows={dashboard ? dashboard.risk : null} />
      </div>

      <Widget title="반별 현황" subtitle="운영 중인 반의 요약 숫자는 현재 단위기간 기준입니다." empty={rows.length === 0 ? { message: "아직 개설된 반이 없습니다. 오른쪽 위 [반 개설]로 시작해 주세요." } : undefined}>
        <DataTable columns={columns} data={rows} getRowKey={(r) => r.id} />
      </Widget>
    </>
  );
}

function sum(list: CohortSummary[], key: "danger" | "warn" | "pendingTickets") {
  return list.reduce((acc, s) => acc + s[key], 0);
}
