import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { AuthCard } from "@/components/shell/AuthCard";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) {
    redirect(user.mustChangePassword ? "/app/password" : "/app");
  }

  return (
    <AuthCard title="로그인" description="학원에서 받은 아이디와 비밀번호를 입력해 주세요.">
      <LoginForm />
      <Link href="/" className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-0.5 text-sm text-neutral-600 hover:text-neutral-900">
        <ChevronLeft className="size-4" aria-hidden />
        처음으로
      </Link>
    </AuthCard>
  );
}
