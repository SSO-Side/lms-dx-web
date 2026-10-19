// 페이지 제목 영역: 제목·설명·뒤로 가기 링크·오른쪽 버튼 자리.
import * as React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export type BackLink = { href: string; label: string };

/** back: 상위 화면으로 가는 링크. 새로고침·직접 진입에도 같은 곳으로 가도록 브라우저 기록 대신 경로 계층을 따른다. */
export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: BackLink;
}) {
  return (
    <div className="mb-5">
      {back && (
        <Link
          href={back.href}
          className="-ml-2 mb-1 inline-flex min-h-11 items-center gap-0.5 rounded-md px-2 text-sm text-neutral-600 transition-colors duration-150 hover:bg-neutral-100 hover:text-neutral-900 sm:min-h-9"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-neutral-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
