"use client";

// 출결 > 오늘 출결표(매니저): 수강생별 출석·지각·조퇴·결석 체크와 하루 마감.
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, CheckCircle2, Loader2 } from "lucide-react";
import { setDayStatusAction, closeDayAction } from "@/server/attendance";
import type { DayEntry } from "@/server/attendance-queries";
import { EV_TYPE_LABELS, EV_TYPE_ORDER, EXCUSED_LABELS } from "@/lib/attendance/labels";
import type { EvType } from "@/lib/attendance/compute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type RowState = { types: EvType[]; excusedType: "SICK" | "LEAVE" | null; note: string };

function initial(e: DayEntry): RowState {
  const absent = e.events.find((x) => x.type === "ABSENT");
  return {
    types: e.events.map((x) => x.type),
    excusedType: absent?.excusedType ?? null,
    note: e.events[0]?.note ?? "",
  };
}

export function DaySheet({
  cohortId,
  date,
  dateLabel,
  isClosed,
  trainingDates,
  entries,
  notTrainingDay,
}: {
  cohortId: number;
  date: string;
  dateLabel: string;
  isClosed: boolean;
  trainingDates: string[];
  entries: DayEntry[];
  notTrainingDay: string | null;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Record<number, RowState>>(() =>
    Object.fromEntries(entries.map((e) => [e.studentId, initial(e)]))
  );
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [errors, setErrors] = useState<Record<number, string | undefined>>({});
  const [closing, startClosing] = useTransition();
  const [closeError, setCloseError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const idx = trainingDates.indexOf(date);
  const prev = idx > 0 ? trainingDates[idx - 1] : null;
  const next = idx >= 0 && idx < trainingDates.length - 1 ? trainingDates[idx + 1] : null;
  const go = (d: string) => router.push(`/app/c/${cohortId}/attendance?tab=today&date=${d}`);

  const summary = useMemo(() => {
    const s = { ABSENT: 0, LATE: 0, EARLY_LEAVE: 0, OUT: 0 } as Record<EvType, number>;
    for (const r of Object.values(rows)) for (const t of r.types) s[t]++;
    return s;
  }, [rows]);

  async function save(studentId: number, next: RowState) {
    const before = rows[studentId];
    setRows((r) => ({ ...r, [studentId]: next }));
    setSaving((s) => ({ ...s, [studentId]: true }));
    setErrors((e) => ({ ...e, [studentId]: undefined }));
    const res = await setDayStatusAction(cohortId, {
      date,
      studentId,
      types: next.types,
      excusedType: next.types.includes("ABSENT") ? next.excusedType : null,
      note: next.note || null,
    });
    setSaving((s) => ({ ...s, [studentId]: false }));
    if (!res.ok) {
      setRows((r) => ({ ...r, [studentId]: before }));
      setErrors((e) => ({ ...e, [studentId]: res.error }));
    }
  }

  function toggle(entry: DayEntry, type: EvType | "PRESENT") {
    const cur = rows[entry.studentId];
    let types: EvType[];
    let excusedType = cur.excusedType;
    if (type === "PRESENT") types = [];
    else if (type === "ABSENT") {
      types = cur.types.includes("ABSENT") ? [] : ["ABSENT"];
      // 승인된 병결·휴가 신청이 있으면 공결을 자동으로 채운다.
      if (!cur.types.includes("ABSENT") && entry.approvedTicket && entry.approvedTicket.reasonType !== "OTHER") {
        excusedType = entry.approvedTicket.reasonType;
      }
    } else {
      const rest = cur.types.filter((t) => t !== "ABSENT");
      types = rest.includes(type) ? rest.filter((t) => t !== type) : [...rest, type];
    }
    save(entry.studentId, { ...cur, types, excusedType: types.includes("ABSENT") ? excusedType : null });
  }

  function closeDay() {
    setCloseError(null);
    startClosing(async () => {
      const res = await closeDayAction(cohortId, date);
      if (!res.ok) {
        setCloseError(res.error);
        return;
      }
      setConfirmOpen(false);
      router.refresh();
    });
  }

  if (trainingDates.length === 0) {
    return <Alert tone="warning">등록된 훈련일이 없습니다. 반 설정에서 훈련 일정을 확인해 주세요.</Alert>;
  }

  return (
    <div className="pb-24">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" aria-label="이전 훈련일" disabled={!prev} onClick={() => prev && go(prev)}>
          <ChevronLeft />
        </Button>
        <Input
          type="date"
          aria-label="출결 날짜"
          className="w-44"
          value={date}
          min={trainingDates[0]}
          max={trainingDates[trainingDates.length - 1]}
          onChange={(e) => e.target.value && go(e.target.value)}
        />
        <Button variant="outline" size="icon" aria-label="다음 훈련일" disabled={!next} onClick={() => next && go(next)}>
          <ChevronRight />
        </Button>
        <span className="ml-1 text-sm font-medium text-neutral-900 tabular-nums">{dateLabel}</span>
        {isClosed && (
          <span className="inline-flex items-center gap-1 rounded-full bg-status-success-bg px-2 py-0.5 text-xs font-medium text-status-success-fg">
            <CheckCircle2 className="size-3.5 text-status-success-solid" aria-hidden />
            확인 완료
          </span>
        )}
      </div>

      {notTrainingDay && (
        <Alert tone="warning" className="mb-3">
          {notTrainingDay}은(는) 훈련일이 아니어서 가장 가까운 이전 훈련일을 표시합니다.
        </Alert>
      )}

      {entries.length === 0 ? (
        <Alert tone="info">재적 수강생이 없습니다. 계정 관리에서 명부를 먼저 등록해 주세요.</Alert>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-card">
          <div className="hidden grid-cols-[minmax(9rem,1fr)_auto_minmax(10rem,14rem)] gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-medium text-neutral-500 md:grid">
            <span>이름</span>
            <span>상태 (기본 출석, 예외만 선택)</span>
            <span>비고</span>
          </div>
          <ul className="divide-y divide-neutral-200">
            {entries.map((entry) => {
              const r = rows[entry.studentId];
              const isAbsent = r.types.includes("ABSENT");
              return (
                <li
                  key={entry.studentId}
                  className={cn(
                    "grid gap-2 px-4 py-2.5 md:grid-cols-[minmax(9rem,1fr)_auto_minmax(10rem,14rem)] md:items-center md:gap-3",
                    r.types.length > 0 && "bg-neutral-50"
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium text-neutral-900">{entry.name}</span>
                    <span className="text-xs text-neutral-500">{entry.loginId}</span>
                    {saving[entry.studentId] && <Loader2 className="size-3.5 animate-spin text-neutral-400" aria-label="저장 중" />}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex flex-wrap gap-1" role="group" aria-label={`${entry.name} 출결 상태`}>
                      <ToggleChip active={r.types.length === 0} onClick={() => toggle(entry, "PRESENT")}>
                        출석
                      </ToggleChip>
                      {EV_TYPE_ORDER.map((t) => (
                        <ToggleChip key={t} active={r.types.includes(t)} tone={t === "ABSENT" ? "danger" : "warning"} onClick={() => toggle(entry, t)}>
                          {EV_TYPE_LABELS[t]}
                        </ToggleChip>
                      ))}
                    </div>
                    {isAbsent && (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                        <span title="병결·휴가는 수강생 신청 승인 시 자동 반영됩니다. 서류를 직접 받은 경우에만 지정하세요.">공결 (증빙 확인 후)</span>
                        {([null, "SICK", "LEAVE"] as const).map((x) => (
                          <label key={x ?? "none"} className="inline-flex items-center gap-1">
                            <input
                              type="radio"
                              name={`excused-${entry.studentId}`}
                              className="accent-primary-500"
                              checked={r.excusedType === x}
                              onChange={() => save(entry.studentId, { ...r, excusedType: x })}
                            />
                            {x ? EXCUSED_LABELS[x] : "아님"}
                          </label>
                        ))}
                        {entry.approvedTicket && (
                          <Link href={`/app/c/${cohortId}/tickets?ticket=${entry.approvedTicket.id}`} className="text-primary-500 hover:underline">
                            신청 #{entry.approvedTicket.id}
                          </Link>
                        )}
                      </div>
                    )}
                    {errors[entry.studentId] && <p className="text-xs text-status-danger-fg">{errors[entry.studentId]}</p>}
                  </div>

                  <Input
                    aria-label={`${entry.name} 비고`}
                    placeholder={r.types.length ? "비고 (선택)" : "출석"}
                    disabled={r.types.length === 0}
                    className="h-9"
                    defaultValue={r.note}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== r.note) save(entry.studentId, { ...r, note: v });
                    }}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-card/95 px-4 py-3 backdrop-blur lg:left-60">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <p className="text-sm text-neutral-600 tabular-nums">
            결석 {summary.ABSENT} · 지각 {summary.LATE} · 조퇴 {summary.EARLY_LEAVE} · 외출 {summary.OUT}
          </p>
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <Button onClick={() => setConfirmOpen(true)} disabled={entries.length === 0}>
              {isClosed ? "다시 확인 완료" : "오늘 출결 확인 완료"}
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{dateLabel} 출결 확인</DialogTitle>
                <DialogDescription>확인하면 최종 반영일이 이 날짜로 갱신됩니다. 이후에도 수정할 수 있습니다.</DialogDescription>
              </DialogHeader>
              <dl className="grid grid-cols-4 gap-2 text-center">
                {EV_TYPE_ORDER.map((t) => (
                  <div key={t} className="rounded-lg bg-neutral-50 py-2">
                    <dt className="text-xs text-neutral-500">{EV_TYPE_LABELS[t]}</dt>
                    <dd className="text-lg font-semibold tabular-nums">{summary[t]}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-sm text-neutral-600">
                출석 {entries.length - Object.values(rows).filter((r) => r.types.includes("ABSENT")).length}명 / 재적 {entries.length}명
              </p>
              {closeError && <Alert tone="danger">{closeError}</Alert>}
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                  취소
                </Button>
                <Button onClick={closeDay} disabled={closing}>
                  {closing ? "저장하는 중…" : "확인 완료"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}

function ToggleChip({
  active,
  tone = "primary",
  onClick,
  children,
}: {
  active: boolean;
  tone?: "primary" | "danger" | "warning";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const activeCls = {
    primary: "border-primary-500 bg-primary-50 text-primary-700",
    danger: "border-status-danger-solid bg-status-danger-bg text-status-danger-fg",
    warning: "border-status-warning-solid bg-status-warning-bg text-status-warning-fg",
  }[tone];
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 min-w-12 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors duration-150",
        active ? activeCls : "border-neutral-200 bg-card text-neutral-600 hover:bg-neutral-100"
      )}
    >
      {children}
    </button>
  );
}

