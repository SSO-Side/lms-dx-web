import Link from "next/link";
import { Settings } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { tryCohortAccess } from "@/lib/access/pageAccess";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { AccessDenied } from "@/components/shell/AccessDenied";
import { PageHeader } from "@/components/shell/PageHeader";
import { ROLE_LABELS } from "@/components/shell/nav";
import { MemberTable, type MemberRow } from "./member-table";

export default async function MembersPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  // 명부는 MANAGER·ACADEMY_ADMIN (attendance:write와 같은 역할 범위)
  const ctx = await tryCohortAccess(cohortId, "attendance:write");
  if (!ctx) return <AccessDenied />;

  const [enrollments, staff] = await Promise.all([
    db.enrollment.findMany({
      where: { cohortId: ctx.cohortId },
      include: { student: { select: { id: true, name: true, loginId: true, phone: true, status: true, lastLoginAt: true } } },
      orderBy: { student: { name: "asc" } },
    }),
    db.cohortStaff.findMany({
      where: { cohortId: ctx.cohortId },
      include: { user: { select: { id: true, name: true, loginId: true, phone: true, status: true, lastLoginAt: true, role: true } } },
      orderBy: { staffRole: "asc" },
    }),
  ]);

  const rows: MemberRow[] = [
    ...staff.map((s) => ({
      userId: s.user.id,
      name: s.user.name,
      loginId: s.user.loginId,
      phone: s.user.phone,
      roleLabel: [ROLE_LABELS[s.user.role], s.title, s.isPrimary ? "주담당" : null].filter(Boolean).join(" · "),
      isStudent: false,
      enrollmentStatus: null,
      accountStatus: s.user.status,
      lastLoginAt: s.user.lastLoginAt ? formatDateTime(s.user.lastLoginAt) : null,
    })),
    ...enrollments.map((e) => ({
      userId: e.student.id,
      name: e.student.name,
      loginId: e.student.loginId,
      phone: e.student.phone,
      roleLabel: ROLE_LABELS.STUDENT,
      isStudent: true,
      enrollmentStatus: e.status,
      accountStatus: e.student.status,
      lastLoginAt: e.student.lastLoginAt ? formatDateTime(e.student.lastLoginAt) : null,
    })),
  ];
  const enrolled = enrollments.filter((e) => e.status === "ENROLLED").length;

  return (
    <>
      <PageHeader
        back={{ href: `/app/c/${ctx.cohortId}`, label: "반 홈" }}
        title="명부"
        description={`수강생 ${enrolled}명 재적 · 교사 ${staff.length}명. 계정 발급·재설정은 학원 관리자의 계정 관리 화면에서 합니다.`}
        actions={
          <Link href={`/app/c/${ctx.cohortId}/settings`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Settings aria-hidden /> 반 설정
          </Link>
        }
      />
      <MemberTable cohortId={ctx.cohortId} rows={rows} />
    </>
  );
}
