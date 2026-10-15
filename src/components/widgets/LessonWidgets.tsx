import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import { Widget } from "@/components/Widget";
import { StatusBadge } from "@/components/StatusBadge";

/** 오늘 수업 (수강생·강사 공유) */
export function TodayLessonWidget({
  cohortId,
  title = "오늘 수업",
  lessons,
}: {
  cohortId: number;
  title?: string;
  lessons: { id: number; weekId: number; title: string; materialCount: number; assignmentCount: number }[];
}) {
  return (
    <Widget
      title={title}
      density="comfortable"
      empty={lessons.length === 0 ? { message: "오늘 등록된 수업이 없습니다." } : undefined}
    >
      <ul className="-mx-1 divide-y divide-neutral-200">
        {lessons.map((l) => (
          <li key={l.id}>
            <Link
              href={`/app/c/${cohortId}/curriculum?week=${l.weekId}`}
              className="flex min-h-11 items-center gap-2 rounded-md px-1 py-2 hover:bg-neutral-50"
            >
              <BookOpen className="size-4 shrink-0 text-primary-500" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900">{l.title}</span>
              <span className="shrink-0 text-xs text-neutral-500 tabular-nums">
                자료 {l.materialCount} · 과제 {l.assignmentCount}
              </span>
              <ChevronRight className="size-4 shrink-0 text-neutral-400" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Widget>
  );
}

function remaining(due: Date, now: Date): string {
  const mins = Math.max(0, Math.floor((due.getTime() - now.getTime()) / 60000));
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  if (d > 0) return `${d}일 ${h}시간 남음`;
  if (h > 0) return `${h}시간 남음`;
  return `${mins % 60}분 남음`;
}

/** 마감 임박 과제 (수강생) */
export function AssignmentDueWidget({
  cohortId,
  items,
  now,
}: {
  cohortId: number;
  items: { id: number; weekId: number; title: string; dueAt: Date; status: string | null }[];
  now: Date;
}) {
  return (
    <Widget
      title="마감 임박 과제"
      density="comfortable"
      empty={items.length === 0 ? { message: "마감이 다가오는 과제가 없습니다." } : undefined}
    >
      <ul className="-mx-1 divide-y divide-neutral-200">
        {items.map((a) => (
          <li key={a.id}>
            <Link
              href={`/app/c/${cohortId}/curriculum?week=${a.weekId}`}
              className="flex min-h-11 items-center gap-2 rounded-md px-1 py-2 hover:bg-neutral-50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-900">{a.title}</p>
                <p className="text-xs text-neutral-500 tabular-nums">{remaining(a.dueAt, now)}</p>
              </div>
              <StatusBadge domain="submission" value={a.status ?? "NONE"} />
            </Link>
          </li>
        ))}
      </ul>
    </Widget>
  );
}

/** 최근 과제 제출 (강사) */
export function SubmissionFeedWidget({
  cohortId,
  items,
}: {
  cohortId: number;
  items: { id: number; studentName: string; assignmentTitle: string; weekId: number; status: string; submittedAt: string }[];
}) {
  return (
    <Widget title="최근 과제 제출" empty={items.length === 0 ? { message: "아직 제출된 과제가 없습니다." } : undefined}>
      <ul className="-mx-1 divide-y divide-neutral-200">
        {items.map((s) => (
          <li key={s.id}>
            <Link
              href={`/app/c/${cohortId}/curriculum?week=${s.weekId}`}
              className="flex min-h-11 items-center gap-2 rounded-md px-1 py-2 hover:bg-neutral-50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-neutral-900">
                  <span className="font-medium">{s.studentName}</span> · {s.assignmentTitle}
                </p>
                <p className="text-xs text-neutral-500 tabular-nums">{s.submittedAt}</p>
              </div>
              <StatusBadge domain="submission" value={s.status} />
            </Link>
          </li>
        ))}
      </ul>
    </Widget>
  );
}
