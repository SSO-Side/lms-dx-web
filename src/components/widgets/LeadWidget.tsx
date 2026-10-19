// 홈 위젯(매니저·슈퍼어드민): 신규 기업 문의.
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Widget } from "@/components/Widget";
import { StatusBadge } from "@/components/StatusBadge";
import type { LeadRow } from "@/server/lead-queries";

/** 매니저·슈퍼어드민 홈: 신규 기업 문의 (최근 7일 건수 + 최근 3건) */
export function NewLeadsWidget({ cohortId, leads, newCount }: { cohortId: number; leads: LeadRow[]; newCount: number }) {
  const href = `/app/c/${cohortId}/leads`;
  return (
    <Widget
      title="신규 문의"
      subtitle={`최근 7일 ${newCount}건 · 마켓플레이스 기업 문의`}
      density="comfortable"
      empty={leads.length === 0 ? { message: "아직 들어온 문의가 없습니다." } : undefined}
    >
      <ul className="-mx-1 divide-y divide-neutral-200">
        {leads.map((l) => (
          <li key={l.id}>
            <Link href={href} className="flex min-h-11 items-center gap-2 rounded-md px-1 py-2 hover:bg-neutral-50">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-900">{l.company}</p>
                <p className="truncate text-xs text-neutral-500">
                  {l.projectTitle} · <span className="tabular-nums">{l.createdAt}</span>
                </p>
              </div>
              <StatusBadge domain="lead" value={l.type} />
            </Link>
          </li>
        ))}
      </ul>
      <Link href={href} className="mt-2 inline-flex min-h-11 items-center gap-0.5 text-sm text-primary-500 hover:underline">
        전체 문의 보기 <ChevronRight className="size-4" aria-hidden />
      </Link>
    </Widget>
  );
}
