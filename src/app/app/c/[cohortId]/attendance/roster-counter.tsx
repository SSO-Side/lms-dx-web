"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil } from "lucide-react";
import {
  getStudentEventsAction,
  upsertEventAction,
  deleteEventAction,
  saveOpeningsAction,
} from "@/server/attendance";
import type { PeriodInfo, StudentAttendance, StudentEventRow } from "@/server/attendance-queries";
import { EV_TYPE_LABELS, EV_TYPE_ORDER, EXCUSED_LABELS } from "@/lib/attendance/labels";
import type { EvType } from "@/lib/attendance/compute";
import { formatYmdWithDow } from "@/lib/dates";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { ProofDialog } from "@/components/tickets/ProofDialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const GRADE_FILTERS = [
  { key: "ALL", label: "전체" },
  { key: "RISK", label: "위험·주의" },
  { key: "DANGER", label: "위험" },
  { key: "WARN", label: "주의" },
  { key: "NORMAL", label: "정상" },
] as const;

const selectCls =
  "h-10 rounded-md border border-neutral-300 bg-card px-3 text-sm text-neutral-900 focus-visible:border-primary-500 focus-visible:outline-2 focus-visible:outline-primary-500/30";

export function RosterCounter({
  cohortId,
  canWrite,
  periods,
  period,
  rows,
  excusedLimit,
  defaultGrade,
  canOpen,
  trainingDates,
  today,
}: {
  today: string;
  cohortId: number;
  canWrite: boolean;
  periods: Omit<PeriodInfo, "trainingDays">[];
  period: PeriodInfo;
  rows: StudentAttendance[];
  excusedLimit: number | null;
  defaultGrade: string;
  canOpen: boolean;
  trainingDates: string[];
}) {
  const router = useRouter();
  const [grade, setGrade] = useState(GRADE_FILTERS.some((g) => g.key === defaultGrade) ? defaultGrade : "ALL");
  const [selected, setSelected] = useState<StudentAttendance | null>(null);
  const [openingMode, setOpeningMode] = useState(false);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const g = r.result.grade;
        if (grade === "ALL") return true;
        if (grade === "RISK") return g === "DANGER" || g === "WARN";
        return g === grade;
      }),
    [rows, grade]
  );

  const columns: Column<StudentAttendance>[] = [
    {
      header: "이름",
      cell: (r) => (
        <span className="font-medium text-neutral-900">
          {r.name}
          {r.hasOpening && <span className="ml-1 text-xs font-normal text-neutral-500">(이관)</span>}
        </span>
      ),
    },
    { header: "결석", align: "right", cell: (r) => r.result.counts.absent, className: "tabular-nums" },
    { header: "지각", align: "right", cell: (r) => r.result.counts.late, className: "tabular-nums" },
    { header: "조퇴", align: "right", cell: (r) => r.result.counts.earlyLeave, className: "tabular-nums" },
    { header: "외출", align: "right", cell: (r) => r.result.counts.out, className: "tabular-nums" },
    { header: "환산 결석", align: "right", cell: (r) => r.result.convertedAbsences, className: "tabular-nums" },
    {
      header: "잔여 허용",
      align: "right",
      cell: (r) => (
        <span className={cn("font-semibold", r.result.remaining < 0 && "text-status-danger-fg")}>
          {r.result.remaining} / {r.result.allowedAbsences}
        </span>
      ),
      className: "tabular-nums",
    },
    { header: "등급", cell: (r) => <StatusBadge domain="attendance" value={r.result.grade} /> },
    {
      header: "병결·휴가",
      align: "right",
      cell: (r) => (excusedLimit === null ? r.result.excusedUsed : `${r.result.excusedUsed}/${excusedLimit}`),
      className: "tabular-nums",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="단위기간"
            className={selectCls}
            value={period.id}
            onChange={(e) => router.push(`/app/c/${cohortId}/attendance?tab=roster&period=${e.target.value}`)}
          >
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} ({p.startDate} ~ {p.endDate})
              </option>
            ))}
          </select>
          <span className="text-sm text-neutral-500 tabular-nums">훈련일 {period.trainingDays}일</span>
        </div>
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="등급 필터">
          {GRADE_FILTERS.map((g) => (
            <button
              key={g.key}
              type="button"
              aria-pressed={grade === g.key}
              onClick={() => setGrade(g.key)}
              className={cn(
                "h-8 rounded-full border px-3 text-caption",
                grade === g.key ? "border-primary-500 bg-primary-50 font-medium text-primary-700" : "border-neutral-200 text-neutral-600 hover:bg-neutral-100"
              )}
            >
              {g.label}
            </button>
          ))}
          {canOpen && !openingMode && (
            <Button variant="outline" size="sm" className="ml-2" onClick={() => setOpeningMode(true)}>
              초기 이관 입력
            </Button>
          )}
        </div>
      </div>

      {openingMode ? (
        <OpeningEditor cohortId={cohortId} period={period} rows={rows} trainingDates={trainingDates} today={today} onDone={() => setOpeningMode(false)} />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(r) => r.studentId}
          onRowClick={(r) => setSelected(r)}
          emptyMessage={rows.length === 0 ? "재적 수강생이 없습니다." : "조건에 맞는 학생이 없습니다."}
        />
      )}

      <StudentDrawer
        cohortId={cohortId}
        canWrite={canWrite}
        period={period}
        student={selected}
        trainingDates={trainingDates}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function StudentDrawer({
  cohortId,
  canWrite,
  period,
  student,
  trainingDates,
  onClose,
}: {
  cohortId: number;
  canWrite: boolean;
  period: PeriodInfo;
  student: StudentAttendance | null;
  trainingDates: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [events, setEvents] = useState<StudentEventRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<number | null>(null);
  const [editing, setEditing] = useState<Partial<StudentEventRow> | null>(null);
  const [deleting, setDeleting] = useState<StudentEventRow | null>(null);
  const [proofTicket, setProofTicket] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const load = (studentId: number) => {
    setLoadError(null);
    getStudentEventsAction(cohortId, studentId, period.id).then((res) => {
      if (res.ok) setEvents(res.events);
      else setLoadError(res.error);
    });
  };

  if (student && loadedFor !== student.studentId) {
    setLoadedFor(student.studentId);
    setEvents(null);
    setEditing(null);
    load(student.studentId);
  }

  const submit = (form: FormData) => {
    if (!student || !editing) return;
    const type = form.get("type") as EvType;
    const excused = form.get("excusedType") as string;
    setFormError(null);
    startTransition(async () => {
      const res = await upsertEventAction(cohortId, {
        eventId: editing.id,
        studentId: student.studentId,
        date: form.get("date") as string,
        type,
        excusedType: type === "ABSENT" && (excused === "SICK" || excused === "LEAVE") ? excused : null,
        note: ((form.get("note") as string) || "").trim() || null,
      });
      if (!res.ok) return setFormError(res.error);
      setEditing(null);
      load(student.studentId);
      router.refresh();
    });
  };

  const remove = () => {
    if (!student || !deleting) return;
    startTransition(async () => {
      const res = await deleteEventAction(cohortId, deleting.id);
      if (!res.ok) return setFormError(res.error);
      setDeleting(null);
      load(student.studentId);
      router.refresh();
    });
  };

  return (
    <Sheet
      open={student !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          setLoadedFor(null);
        }
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{student?.name}</SheetTitle>
          <SheetDescription>
            {period.label} · {period.startDate} ~ {period.endDate}
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-4">
          {student && (
            <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2.5 text-sm">
              <span>
                잔여 허용 <b className="tabular-nums">{student.result.remaining}</b> / {student.result.allowedAbsences}일 · 환산 결석{" "}
                <span className="tabular-nums">{student.result.convertedAbsences}</span>
              </span>
              <StatusBadge domain="attendance" value={student.result.grade} />
            </div>
          )}

          {loadError && <Alert tone="danger">{loadError}</Alert>}
          {events === null && !loadError && (
            <div className="space-y-2" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-neutral-100" />
              ))}
            </div>
          )}
          {events && events.length === 0 && <p className="py-4 text-center text-sm text-neutral-500">이 단위기간에는 기록이 없습니다.</p>}
          {events && events.length > 0 && (
            <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
              {events.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="tabular-nums text-neutral-700">{formatYmdWithDow(e.date)}</span>
                      <StatusBadge domain="attendanceEvent" value={e.type} />
                      {e.excused && e.excusedType && (
                        <StatusBadge domain="attendanceEvent" value="EXCUSED" label={`공결·${EXCUSED_LABELS[e.excusedType]}`} />
                      )}
                    </div>
                    {e.note && <p className="mt-0.5 truncate text-xs text-neutral-500">{e.note}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {e.hasProof && e.ticketId && (
                      <Button variant="ghost" size="xs" onClick={() => setProofTicket(e.ticketId)}>
                        증빙 보기
                      </Button>
                    )}
                    {canWrite && (
                      <>
                        <Button variant="ghost" size="icon-sm" aria-label="수정" onClick={() => setEditing(e)}>
                          <Pencil />
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label="삭제" onClick={() => setDeleting(e)}>
                          <Trash2 />
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {canWrite && editing && (
            <form action={submit} className="space-y-3 rounded-lg border border-primary-200 bg-primary-50/40 p-3">
              <p className="text-sm font-medium text-neutral-900">{editing.id ? "기록 수정" : "기록 추가"}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ev-date">날짜</Label>
                  <Input
                    id="ev-date"
                    name="date"
                    type="date"
                    required
                    min={period.startDate}
                    max={period.endDate}
                    defaultValue={editing.date ?? trainingDates.filter((d) => d >= period.startDate && d <= period.endDate).at(-1)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ev-type">유형</Label>
                  <select id="ev-type" name="type" className={cn(selectCls, "w-full")} defaultValue={editing.type ?? "ABSENT"}>
                    {EV_TYPE_ORDER.map((t) => (
                      <option key={t} value={t}>
                        {EV_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-excused">공결 (결석일 때만)</Label>
                <select id="ev-excused" name="excusedType" className={cn(selectCls, "w-full")} defaultValue={editing.excusedType ?? ""}>
                  <option value="">아님</option>
                  <option value="SICK">병결</option>
                  <option value="LEAVE">휴가</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-note">비고</Label>
                <Input id="ev-note" name="note" defaultValue={editing.note ?? ""} maxLength={300} />
              </div>
              {formError && <Alert tone="danger">{formError}</Alert>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
                  취소
                </Button>
                <Button type="submit" size="sm" disabled={pending}>
                  {pending ? "저장 중…" : "저장"}
                </Button>
              </div>
            </form>
          )}
          <p className="text-xs text-neutral-500">모든 추가·수정·삭제는 변경 이력에 기록됩니다.</p>
        </SheetBody>
        {canWrite && (
          <SheetFooter>
            <Button onClick={() => setEditing({})} disabled={!!editing}>
              <Plus /> 일자 기록 추가
            </Button>
          </SheetFooter>
        )}
      </SheetContent>

      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>기록을 삭제할까요?</DialogTitle>
            <DialogDescription>
              {deleting && `${deleting.date} ${EV_TYPE_LABELS[deleting.type]} 기록을 삭제합니다. 변경 이력에는 남습니다.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              취소
            </Button>
            <Button variant="destructive" onClick={remove} disabled={pending}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProofDialog cohortId={cohortId} ticketId={proofTicket} onClose={() => setProofTicket(null)} />
    </Sheet>
  );
}

const OPENING_FIELDS = [
  { key: "absent", label: "결석" },
  { key: "late", label: "지각" },
  { key: "earlyLeave", label: "조퇴" },
  { key: "out", label: "외출" },
  { key: "excusedUsed", label: "병결·휴가" },
] as const;
type OpeningKey = (typeof OPENING_FIELDS)[number]["key"];

function OpeningEditor({
  cohortId,
  period,
  rows,
  trainingDates,
  today,
  onDone,
}: {
  cohortId: number;
  period: PeriodInfo;
  rows: StudentAttendance[];
  trainingDates: string[];
  today: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<number, Record<OpeningKey, number>>>(() =>
    Object.fromEntries(rows.map((r) => [r.studentId, { absent: 0, late: 0, earlyLeave: 0, out: 0, excusedUsed: 0 }]))
  );
  const lastInPeriod = trainingDates.filter((d) => d >= period.startDate && d <= period.endDate && d < today).at(-1);
  const [asOfDate, setAsOfDate] = useState(lastInPeriod ?? period.startDate);
  const [paste, setPaste] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const applyPaste = () => {
    // 엑셀에서 복사한 행(탭 구분): 결석 지각 조퇴 외출 병결·휴가 — 명부 순서대로
    const lines = paste.trim().split(/\r?\n/).filter(Boolean);
    setValues((prev) => {
      const next = { ...prev };
      lines.forEach((line, i) => {
        const r = rows[i];
        if (!r) return;
        const nums = line.split(/\t|,/).map((x) => parseInt(x.trim(), 10)).filter((n) => !isNaN(n));
        const cols = nums.length > 5 ? nums.slice(-5) : nums;
        const v = { ...next[r.studentId] };
        OPENING_FIELDS.forEach((f, j) => {
          if (cols[j] !== undefined && cols[j] >= 0) v[f.key] = cols[j];
        });
        next[r.studentId] = v;
      });
      return next;
    });
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const res = await saveOpeningsAction(cohortId, {
        periodId: period.id,
        asOfDate,
        rows: rows.map((r) => ({ studentId: r.studentId, ...values[r.studentId] })),
      });
      if (!res.ok) {
        setError(res.error);
        setConfirm(false);
        return;
      }
      setConfirm(false);
      onDone();
      router.refresh();
    });
  };

  return (
    <div className="space-y-3 rounded-xl border border-primary-200 bg-card p-4">
      <Alert tone="info">
        진행 중인 반의 기존 누계를 {period.label}에 한 번만 입력합니다. 기준일 이하의 일자 기록은 계산에서 제외되고, 이후 기록만 더해집니다.
      </Alert>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="asof">기준일 (이 날까지의 누계)</Label>
          <Input id="asof" type="date" className="w-44" min={period.startDate} max={period.endDate} value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
        </div>
        <div className="min-w-64 flex-1 space-y-1.5">
          <Label htmlFor="paste">붙여넣기 (명부 순서, 열: 결석·지각·조퇴·외출·병결휴가)</Label>
          <div className="flex gap-2">
            <Textarea id="paste" className="min-h-10 h-10" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="엑셀에서 복사해 붙여넣기" />
            <Button variant="outline" onClick={applyPaste} disabled={!paste.trim()}>
              적용
            </Button>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">이름</th>
              {OPENING_FIELDS.map((f) => (
                <th key={f.key} className="px-2 py-2 text-right font-medium">
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {rows.map((r) => (
              <tr key={r.studentId}>
                <td className="px-3 py-1.5 font-medium text-neutral-900">{r.name}</td>
                {OPENING_FIELDS.map((f) => (
                  <td key={f.key} className="px-2 py-1.5 text-right">
                    <Input
                      type="number"
                      min={0}
                      aria-label={`${r.name} ${f.label}`}
                      className="ml-auto h-8 w-16 text-right tabular-nums"
                      value={values[r.studentId][f.key]}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [r.studentId]: { ...v[r.studentId], [f.key]: Math.max(0, parseInt(e.target.value, 10) || 0) } }))
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone}>
          취소
        </Button>
        <Button onClick={() => setConfirm(true)} disabled={rows.length === 0}>
          이관값 저장
        </Button>
      </div>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>초기 이관값을 저장할까요?</DialogTitle>
            <DialogDescription>
              {period.label}, 기준일 {asOfDate}. 반당 한 번만 입력할 수 있고 저장 후에는 이 화면에서 다시 입력할 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              취소
            </Button>
            <Button onClick={save} disabled={pending}>
              {pending ? "저장 중…" : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
