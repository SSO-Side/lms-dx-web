// 학원 전체 대시보드 위젯(슈퍼어드민·서브 관리자): 처리 대기 티켓, 위험·주의 학생 — 모든 반을 가로질러 보여 준다.
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Widget } from "@/components/Widget";
import { StatusBadge } from "@/components/StatusBadge";
import { TICKET_TYPE_LABELS } from "@/lib/tickets/labels";
import { formatDateTime } from "@/lib/dates";
import type { AcademyPendingTicket, AcademyRiskStudent } from "@/server/dashboard-queries";

/** 모든 반의 처리 대기 티켓(대기·검토 중, 오래된 순). 행을 누르면 그 반의 티켓 화면. */
export function AcademyPendingTicketsWidget({ tickets, total }: { tickets: AcademyPendingTicket[] | null; total: number }) {
  if (tickets === null) return <Widget title="처리 대기 티켓" error="불러오지 못했습니다. 새로 고침해 주세요." />;
  return (
    <Widget
      title="처리 대기 티켓"
      subtitle={`전체 반 · 대기·검토 중 ${total}건 · 오래된 순`}
      empty={tickets.length === 0 ? { message: "처리할 티켓이 없습니다." } : undefined}
    >
      <ul className="-mx-1 divide-y divide-neutral-200">
        {tickets.map((t) => (
          <li key={t.id}>
            <Link
              href={`/app/c/${t.cohortId}/tickets`}
              className="flex min-h-11 items-center gap-2 rounded-md px-1 py-2 hover:bg-neutral-50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-900">{t.title}</p>
                <p className="truncate text-xs text-neutral-500">
                  {t.cohortName} · {t.requesterName} · {TICKET_TYPE_LABELS[t.type]} ·{" "}
                  <span className="tabular-nums">{formatDateTime(t.createdAt)}</span>
                </p>
              </div>
              <StatusBadge domain="ticket" value={t.status} />
            </Link>
          </li>
        ))}
      </ul>
    </Widget>
  );
}

/** 모든 반의 위험·주의 학생(잔여 허용일 적은 순, 최대 8명). 행을 누르면 그 반의 출결 명부. */
export function AcademyRiskStudentsWidget({ rows }: { rows: AcademyRiskStudent[] | null }) {
  if (rows === null) return <Widget title="위험·주의 학생" error="불러오지 못했습니다. 새로 고침해 주세요." />;
  return (
    <Widget
      title="위험·주의 학생"
      subtitle={`전체 반 · ${rows.length}명 · 현재 단위기간 · 참고용`}
      empty={rows.length === 0 ? { message: "위험·주의 학생이 없습니다." } : undefined}
    >
      <ul className="-mx-1 divide-y divide-neutral-200">
        {rows.slice(0, 8).map((r) => (
          <li key={`${r.cohortId}-${r.studentId}`}>
            <Link
              href={`/app/c/${r.cohortId}/attendance?tab=roster&grade=RISK`}
              className="flex min-h-11 items-center gap-2 rounded-md px-1 py-1.5 hover:bg-neutral-50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-900">{r.name}</p>
                <p className="truncate text-xs text-neutral-500">{r.cohortName}</p>
              </div>
              <span className="text-xs text-neutral-500 tabular-nums">
                잔여 {r.remaining}/{r.allowedAbsences}일
              </span>
              <StatusBadge domain="attendance" value={r.grade} />
              <ChevronRight className="size-4 shrink-0 text-neutral-400" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Widget>
  );
}
