import * as React from "react";
import { AlertCircle, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WidgetProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  loading?: boolean;
  error?: React.ReactNode;
  /** 빈 상태: "아직 ○○이 없습니다" + 다음 행동 버튼 한 개 (ia.md §4). */
  empty?: boolean | { message: string; action?: React.ReactNode };
  density?: "compact" | "comfortable";
  className?: string;
  children?: React.ReactNode;
}

/** 모든 대시보드 카드의 공통 틀. 로딩·빈 상태·오류 상태를 위젯 단위로 격리한다. */
export function Widget({
  title,
  subtitle,
  action,
  loading = false,
  error,
  empty,
  density = "compact",
  className,
  children,
}: WidgetProps) {
  const pad = density === "compact" ? "p-3" : "p-4";

  return (
    <section className={cn("flex flex-col rounded-xl border border-neutral-200 bg-card", className)}>
      <header className={cn("flex items-start justify-between gap-3 border-b border-neutral-200", pad)}>
        <div className="min-w-0">
          <h3 className={cn("font-semibold text-neutral-900", density === "compact" ? "text-sm" : "text-base")}>
            {title}
          </h3>
          {subtitle && <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>

      <div className={cn("flex-1", pad)}>
        {loading ? (
          <div className="space-y-2 py-1" aria-busy="true" aria-label="불러오는 중">
            <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-100" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-neutral-100" />
            <div className="h-8 w-full animate-pulse rounded bg-neutral-100" />
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 rounded-md bg-status-danger-bg px-3 py-2.5 text-sm text-status-danger-fg" role="alert">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-status-danger-solid" aria-hidden />
            <div>{error}</div>
          </div>
        ) : empty ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
            <Inbox className="size-6 text-neutral-400" aria-hidden />
            <p className="text-sm text-neutral-500">
              {typeof empty === "object" ? empty.message : "아직 내용이 없습니다."}
            </p>
            {typeof empty === "object" && empty.action && <div className="mt-1">{empty.action}</div>}
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
