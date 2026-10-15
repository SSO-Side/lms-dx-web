import { tryCohortAccess } from "@/lib/access/pageAccess";
import { hasActionPermission } from "@/lib/access/permissions";
import { db } from "@/lib/db";
import { dateToYmd } from "@/lib/dates";
import { AccessDenied } from "@/components/shell/AccessDenied";
import { PageHeader } from "@/components/shell/PageHeader";
import { getAttendanceBase } from "@/server/attendance-queries";
import { computeAttendance } from "@/lib/attendance/compute";
import { SettingsForms } from "./settings-forms";

export default async function SettingsPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  // 반 설정: MANAGER 읽기, ACADEMY_ADMIN 수정 (ia.md §1)
  const ctx = await tryCohortAccess(cohortId, "attendance:write");
  if (!ctx) return <AccessDenied />;
  const canEdit = hasActionPermission(ctx.role, "account:manage");

  const [cohort, base] = await Promise.all([
    db.cohort.findUnique({
      where: { id: ctx.cohortId },
      select: { name: true, trainingType: true, room: true, status: true, startDate: true, endDate: true, weeklySchedule: true, holidays: true },
    }),
    getAttendanceBase(ctx.cohortId),
  ]);
  if (!cohort) return <AccessDenied />;

  return (
    <>
      <PageHeader title="반 설정" description={canEdit ? "변경 사항은 저장 전에 확인합니다." : "읽기 전용입니다. 변경은 학원 관리자에게 요청해 주세요."} />
      <SettingsForms
        cohortId={ctx.cohortId}
        canEdit={canEdit}
        info={{ name: cohort.name, trainingType: cohort.trainingType ?? "", room: cohort.room ?? "", status: cohort.status }}
        schedule={{
          startDate: dateToYmd(cohort.startDate),
          endDate: dateToYmd(cohort.endDate),
          weekly: (cohort.weeklySchedule ?? {}) as Record<string, [string, string]>,
          holidays: Array.isArray(cohort.holidays) ? (cohort.holidays as string[]) : [],
          trainingDayCount: base.days.filter((d) => d.isTraining).length,
        }}
        periods={base.periods.map((p) => ({
          ...p,
          allowedAbsences: computeAttendance({ trainingDays: p.trainingDays, events: [], config: base.config }).allowedAbsences,
        }))}
        config={base.config}
      />
    </>
  );
}
