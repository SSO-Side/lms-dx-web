// 학원 관리 화면(/app/academy/...)의 공통 틀. 학원 관리자·슈퍼어드민만 들어온다.
import { Role } from "@prisma/client";
import { requireAuthUser } from "@/lib/auth/session";
import { getAcademyName } from "@/server/shell-queries";
import { AppShell } from "@/components/shell/AppShell";
import { AccessDenied } from "@/components/shell/AccessDenied";
import { academyNav, ROLE_LABELS } from "@/components/shell/nav";

export default async function AcademyLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuthUser();
  if (user.role !== Role.ACADEMY_ADMIN && user.role !== Role.ADMIN) {
    return <AccessDenied />;
  }

  const academyName = await getAcademyName(user.academyId);

  return (
    <AppShell
      title={academyName ?? "학원 관리"}
      nav={academyNav()}
      user={{ name: user.name, roleLabel: ROLE_LABELS[user.role] }}
    >
      {children}
    </AppShell>
  );
}
