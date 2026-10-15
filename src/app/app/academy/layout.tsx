import { Role } from "@prisma/client";
import { requireAuthUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { AppShell } from "@/components/shell/AppShell";
import { AccessDenied } from "@/components/shell/AccessDenied";
import { academyNav, ROLE_LABELS } from "@/components/shell/nav";

export default async function AcademyLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuthUser();
  if (user.role !== Role.ACADEMY_ADMIN && user.role !== Role.ADMIN) {
    return <AccessDenied />;
  }

  const academy = user.academyId
    ? await db.academy.findUnique({ where: { id: user.academyId }, select: { name: true } })
    : null;

  return (
    <AppShell
      title={academy?.name ?? "학원 관리"}
      nav={academyNav()}
      user={{ name: user.name, roleLabel: ROLE_LABELS[user.role] }}
    >
      {children}
    </AppShell>
  );
}
