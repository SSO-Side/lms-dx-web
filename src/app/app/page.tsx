import { redirect } from "next/navigation";
import { Role, EnrollmentStatus } from "@prisma/client";
import { requireAuthUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logoutAction } from "@/server/auth";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/components/shell/AuthCard";

export default async function AppRootPage() {
  const user = await requireAuthUser();

  if (user.role === Role.ACADEMY_ADMIN || user.role === Role.ADMIN) {
    redirect("/app/academy");
  }

  if (user.role === Role.STUDENT) {
    const enrollment = await db.enrollment.findFirst({
      where: {
        studentId: user.id,
        status: EnrollmentStatus.ENROLLED,
      },
      select: { cohortId: true },
    });

    if (enrollment) {
      redirect(`/app/c/${enrollment.cohortId}`);
    }
  }

  if (user.role === Role.INSTRUCTOR || user.role === Role.MANAGER) {
    const staffList = await db.cohortStaff.findMany({
      where: { userId: user.id },
      select: { cohortId: true },
    });

    if (staffList.length === 1) {
      redirect(`/app/c/${staffList[0].cohortId}`);
    } else {
      redirect("/app/overview");
    }
  }

  return (
    <AuthCard title="배정된 반이 없습니다" description="학원 관리자에게 반 배정을 요청해 주세요.">
      <form action={logoutAction}>
        <Button type="submit" variant="outline" className="w-full">
          로그아웃
        </Button>
      </form>
    </AuthCard>
  );
}
