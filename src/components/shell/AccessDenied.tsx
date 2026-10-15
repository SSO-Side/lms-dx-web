import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/** 권한 없는 접근은 존재 여부를 알리지 않고 같은 화면을 보여 준다 (ia.md §4). */
export function AccessDenied() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-card p-6 text-center">
        <ShieldAlert className="mx-auto size-8 text-neutral-400" aria-hidden />
        <h1 className="mt-3 text-base font-semibold text-neutral-900">접근할 수 없습니다</h1>
        <p className="mt-1 text-sm text-neutral-500">소속되거나 배정된 화면만 볼 수 있습니다.</p>
        <Link href="/app" className={buttonVariants({ variant: "outline", className: "mt-5 w-full" })}>
          내 홈으로 이동
        </Link>
      </div>
    </main>
  );
}
