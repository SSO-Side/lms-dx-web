// 학원 관리 화면(/app/academy/...)의 공통 틀. 슈퍼어드민·서브 관리자·시스템 관리자만 들어온다.
import { requireAuthUser } from "@/lib/auth/session";
import { isAcademyStaffRole } from "@/lib/access/checker";
import { getAcademyName } from "@/server/shell-queries";
import { AppShell } from "@/components/shell/AppShell";
import { AccessDenied } from "@/components/shell/AccessDenied";
import { academyNav, ROLE_LABELS } from "@/components/shell/nav";

export default async function AcademyLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuthUser();
  if (!isAcademyStaffRole(user.role)) {
    return <AccessDenied />;
  }

  const academyName = await getAcademyName(user.academyId);

  return (
    <AppShell
      title={academyName ?? "학원 관리"}
      nav={academyNav(user.role)}
      user={{ name: user.name, roleLabel: ROLE_LABELS[user.role] }}
    >
      {children}
    </AppShell>
  );
}
