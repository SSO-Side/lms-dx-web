import Link from "next/link";
import { LogIn, Store } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md text-center">
        <p className="text-sm font-medium text-primary-600">KDT 학원 반 단위 LMS</p>
        <h1 className="mt-2 text-3xl font-semibold text-neutral-900">lms_kdt</h1>
        <p className="mt-3 text-base text-neutral-600">출결·결석계·자료·과제를 반 단위로 한곳에서 관리합니다.</p>

        <div className="mt-8 flex flex-col gap-3">
          <Link href="/login" className={buttonVariants({ size: "lg", className: "w-full" })}>
            <LogIn aria-hidden />
            LMS 로그인
          </Link>
          <Link href="/market" className={buttonVariants({ variant: "outline", size: "lg", className: "w-full" })}>
            <Store aria-hidden />
            마켓플레이스
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">준비 중</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
