// 마켓플레이스(/market) 공통 틀: 상단 바·본문·하단과 검색 노출 설정.
import type { Metadata } from "next";
import Link from "next/link";
import { Store } from "lucide-react";

// 공개 영역(로그인 없음). 기본은 검색 노출 차단(noindex), 운영에서 MARKET_INDEXABLE=true 일 때만 허용.
const indexable = process.env.MARKET_INDEXABLE === "true";

/** 마켓플레이스 기본 메타데이터. 검색 노출은 MARKET_INDEXABLE=true일 때만 */
export const metadata: Metadata = {
  title: { default: "마켓플레이스 · lms_kdt", template: "%s · lms_kdt 마켓플레이스" },
  description: "KDT 수강생 팀 프로젝트 쇼케이스와 기업 문의",
  robots: indexable ? { index: true, follow: true } : { index: false, follow: false, nocache: true },
};

/** 마켓플레이스 공통 틀(상단 바·본문·하단) */
export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-base">
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-card">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4">
          <Link href="/market" className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary-700">
            <Store className="size-5" aria-hidden />
            마켓플레이스
          </Link>
          <Link href="/" className="inline-flex min-h-11 items-center text-sm text-neutral-600 hover:text-neutral-900">
            처음으로
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:py-10">{children}</main>
      <footer className="border-t border-neutral-200 bg-card">
        <p className="mx-auto w-full max-w-6xl px-4 py-5 text-xs text-neutral-500">
          공개된 프로젝트는 팀원 전원 동의, 강사 검토, 학원 승인을 거친 것만 표시됩니다. 팀원은 언제든 비공개로 전환할 수 있습니다.
        </p>
      </footer>
    </div>
  );
}
