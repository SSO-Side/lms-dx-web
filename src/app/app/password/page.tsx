import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { AuthCard } from "@/components/shell/AuthCard";
import { PasswordForm } from "./password-form";

export default async function PasswordPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <AuthCard
      title="비밀번호 변경"
      description={
        user.mustChangePassword
          ? "처음 로그인하셨습니다. 계속하려면 비밀번호를 바꿔 주세요."
          : "새 비밀번호는 8자 이상으로 입력해 주세요."
      }
    >
      <PasswordForm canCancel={!user.mustChangePassword} />
    </AuthCard>
  );
}
