"use client";

// 로그인 후 화면(/app/...)에서 오류가 나면 보여 주는 공통 오류 화면.
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-card p-6 text-center">
        <AlertCircle className="mx-auto size-8 text-status-danger-solid" aria-hidden />
        <h1 className="mt-3 text-base font-semibold text-neutral-900">화면을 불러오지 못했습니다</h1>
        <p className="mt-1 text-sm text-neutral-500">권한이 없거나 일시적인 오류입니다. 다시 시도해 주세요.</p>
        <div className="mt-5 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={reset}>
            다시 시도
          </Button>
          <Link href="/app" className={buttonVariants({ className: "flex-1" })}>
            내 홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}
