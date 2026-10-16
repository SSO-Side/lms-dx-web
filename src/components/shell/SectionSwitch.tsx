import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * 메뉴 하나에 묶인 화면 사이 전환 (ia.md §2: 강사·매니저 "서류·프로젝트" = 서류 · 팀 프로젝트).
 * 메뉴 5개 이내를 지키려고 두 화면을 한 메뉴 아래 둔다.
 */
export function SectionSwitch({ items, current }: { items: Array<{ key: string; label: string; href: string }>; current: string }) {
  return (
    <nav className="mb-3 inline-flex rounded-lg border border-neutral-200 bg-card p-0.5" aria-label="화면 전환">
      {items.map((it) => (
        <Link
          key={it.key}
          href={it.href}
          aria-current={current === it.key ? "page" : undefined}
          className={cn(
            "inline-flex min-h-9 items-center rounded-md px-3 text-sm font-medium transition-colors duration-150",
            current === it.key ? "bg-primary-50 text-primary-700" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
          )}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}

/** 강사·매니저·슈퍼어드민의 "서류·프로젝트" 메뉴 아래 화면. withLeads: 기업 문의(lead:read 역할만, 메뉴 5개 이내 유지) */
export function careerSections(cohortId: number, withLeads = false) {
  return [
    { key: "resume", label: "서류", href: `/app/c/${cohortId}/resume` },
    { key: "team", label: "팀 프로젝트", href: `/app/c/${cohortId}/team` },
    ...(withLeads ? [{ key: "leads", label: "기업 문의", href: `/app/c/${cohortId}/leads` }] : []),
  ];
}
