import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { AuthCard } from "@/components/shell/AuthCard";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) {
    redirect(user.mustChangePassword ? "/app/password" : "/app");
  }

  return (
    <AuthCard title="로그인" description="학원에서 받은 아이디와 비밀번호를 입력해 주세요.">
      <LoginForm />
    </AuthCard>
  );
}
