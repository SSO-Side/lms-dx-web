// 로그인·비밀번호 변경 화면용 가운데 카드 틀.
import * as React from "react";
import Link from "next/link";

/** 로그인·비밀번호 변경·안내 화면용 중앙 카드. */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <Link href="/" className="mb-6 text-lg font-semibold text-primary-700">
        lms_kdt
      </Link>
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-card p-6">
        <div className="mb-5">
          <h1 className="text-xl font-semibold text-neutral-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
        </div>
        {children}
      </div>
    </main>
  );
}
