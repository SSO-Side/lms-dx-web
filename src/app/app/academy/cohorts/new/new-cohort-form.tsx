"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { createCohortAction } from "@/server/academy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  DEFAULT_WEEKLY_SCHEDULE,
  generateMonthlyPeriods,
  generateTrainingDays,
  type WeeklySchedule,
} from "@/lib/attendance/schedule";

// ia.md §3 반 개설 마법사 4단계
const STEPS = ["기본 정보", "일정", "단위기간", "담당자"] as const;
const DAYS = [
  { key: "1", label: "월" },
  { key: "2", label: "화" },
  { key: "3", label: "수" },
  { key: "4", label: "목" },
  { key: "5", label: "금" },
  { key: "6", label: "토" },
  { key: "0", label: "일" },
];

type StaffOption = { id: number; name: string; loginId: string; role: string };

export function NewCohortForm({ staffOptions }: { staffOptions: StaffOption[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState({ name: "", trainingType: "K-Digital Training", room: "", startDate: "", endDate: "" });
  const [schedule, setSchedule] = useState<WeeklySchedule>(DEFAULT_WEEKLY_SCHEDULE);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [holidayInput, setHolidayInput] = useState("");
  const [staff, setStaff] = useState<number[]>([]);
  const [primaryId, setPrimaryId] = useState<number | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);

  const [state, formAction, isPending] = useActionState(async (prev: unknown, formData: FormData) => {
    const res = await createCohortAction(prev, formData);
    if (res?.success && res.cohortId) {
      router.push(`/app/academy/cohorts/${res.cohortId}/accounts`);
      return null;
    }
    return res;
  }, null);

  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const datesReady = !!values.startDate && !!values.endDate && values.endDate >= values.startDate;
  const trainingDays = useMemo(
    () => (datesReady ? generateTrainingDays(values.startDate, values.endDate, schedule, holidays) : []),
    [datesReady, values.startDate, values.endDate, schedule, holidays]
  );
  const periods = useMemo(
    () => (datesReady ? generateMonthlyPeriods(values.startDate, values.endDate) : []),
    [datesReady, values.startDate, values.endDate]
  );
  const trainingCount = trainingDays.filter((d) => d.isTraining).length;
  const countIn = (s: string, e: string) => trainingDays.filter((d) => d.isTraining && d.date >= s && d.date <= e).length;

  const toggleDay = (key: string) =>
    setSchedule((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = ["09:00", "17:40"];
      return next;
    });
  const setTime = (key: string, idx: 0 | 1, value: string) =>
    setSchedule((prev) => {
      const pair = [...prev[key]] as [string, string];
      pair[idx] = value;
      return { ...prev, [key]: pair };
    });
  const addHoliday = () => {
    if (!holidayInput || holidays.includes(holidayInput)) return;
    setHolidays((h) => [...h, holidayInput].sort());
    setHolidayInput("");
  };
  const toggleStaff = (opt: StaffOption) => {
    setStaff((prev) => (prev.includes(opt.id) ? prev.filter((id) => id !== opt.id) : [...prev, opt.id]));
    if (opt.role === "MANAGER") setPrimaryId((p) => (p === opt.id ? null : p ?? opt.id));
  };

  const goNext = () => {
    const section = formRef.current?.querySelector<HTMLElement>(`[data-step="${step}"]`);
    const invalid = section?.querySelector<HTMLInputElement>("input:invalid");
    if (invalid) {
      invalid.reportValidity();
      return;
    }
    if (step === 1) {
      if (!datesReady) return setStepError("종료일은 시작일 이후여야 합니다.");
      if (Object.keys(schedule).length === 0) return setStepError("수업 요일을 하나 이상 선택해 주세요.");
    }
    setStepError(null);
    setStep((s) => s + 1);
  };

  const managers = staffOptions.filter((o) => o.role === "MANAGER");
  const instructors = staffOptions.filter((o) => o.role === "INSTRUCTOR");

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      <input type="hidden" name="weeklySchedule" value={JSON.stringify(schedule)} />
      <input type="hidden" name="holidays" value={JSON.stringify(holidays)} />
      <input
        type="hidden"
        name="staff"
        value={JSON.stringify(staff.map((userId) => ({ userId, isPrimary: userId === primaryId })))}
      />

      <ol className="flex items-center gap-2" aria-label="진행 단계">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                i < step && "bg-primary-500 text-white",
                i === step && "border-2 border-primary-500 text-primary-700",
                i > step && "border border-neutral-300 text-neutral-500"
              )}
              aria-current={i === step ? "step" : undefined}
            >
              {i < step ? <Check className="size-4" aria-hidden /> : i + 1}
            </span>
            <span className={cn("hidden text-sm sm:inline", i === step ? "font-medium text-neutral-900" : "text-neutral-500")}>
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-neutral-200" aria-hidden />}
          </li>
        ))}
      </ol>

      {(stepError || state?.error) && <Alert tone="danger">{stepError ?? state?.error}</Alert>}

      <div data-step="0" className={cn("space-y-4", step !== 0 && "hidden")}>
        <Field id="name" label="과정명">
          <Input id="name" name="name" value={values.name} onChange={set("name")} placeholder="예: 자율주행 협동로봇 개발자 1기" required autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="trainingType" label="훈련 직종">
            <Input id="trainingType" name="trainingType" value={values.trainingType} onChange={set("trainingType")} />
          </Field>
          <Field id="room" label="강의실" hint="선택">
            <Input id="room" name="room" value={values.room} onChange={set("room")} placeholder="예: 6층 601호" />
          </Field>
        </div>
      </div>

      <div data-step="1" className={cn("space-y-5", step !== 1 && "hidden")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="startDate" label="훈련 시작일">
            <Input id="startDate" name="startDate" type="date" value={values.startDate} onChange={set("startDate")} required />
          </Field>
          <Field id="endDate" label="훈련 종료일">
            <Input id="endDate" name="endDate" type="date" value={values.endDate} onChange={set("endDate")} min={values.startDate || undefined} required />
          </Field>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-caption font-medium text-neutral-700">요일별 훈련 시간</legend>
          <div className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
            {DAYS.map((d) => {
              const on = !!schedule[d.key];
              return (
                <div key={d.key} className="flex items-center gap-3 px-3 py-2">
                  <label className="flex w-14 items-center gap-2 text-sm">
                    <input type="checkbox" className="size-4 accent-primary-500" checked={on} onChange={() => toggleDay(d.key)} />
                    {d.label}
                  </label>
                  {on ? (
                    <div className="flex items-center gap-2">
                      <Input type="time" aria-label={`${d.label} 시작`} className="h-9 w-28" value={schedule[d.key][0]} onChange={(e) => setTime(d.key, 0, e.target.value)} />
                      <span className="text-neutral-400">~</span>
                      <Input type="time" aria-label={`${d.label} 종료`} className="h-9 w-28" value={schedule[d.key][1]} onChange={(e) => setTime(d.key, 1, e.target.value)} />
                    </div>
                  ) : (
                    <span className="text-sm text-neutral-400">수업 없음</span>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-caption font-medium text-neutral-700">휴강일</legend>
          <div className="flex gap-2">
            <Input type="date" aria-label="휴강일" value={holidayInput} min={values.startDate || undefined} max={values.endDate || undefined} onChange={(e) => setHolidayInput(e.target.value)} className="max-w-48" />
            <Button variant="outline" onClick={addHoliday} disabled={!holidayInput}>추가</Button>
          </div>
          {holidays.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {holidays.map((h) => (
                <li key={h} className="inline-flex items-center gap-1 rounded-full bg-neutral-100 py-1 pr-1 pl-3 text-sm tabular-nums text-neutral-700">
                  {h}
                  <button type="button" aria-label={`${h} 삭제`} className="rounded-full p-0.5 hover:bg-neutral-200" onClick={() => setHolidays((x) => x.filter((v) => v !== h))}>
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        {datesReady && (
          <Alert tone="info">훈련일 미리보기: 총 {trainingCount}일 (휴강 {trainingDays.length - trainingCount}일 제외)</Alert>
        )}
      </div>

      {step === 2 && (
        <div className="space-y-3">
          <p className="text-sm text-neutral-500">시작일 기준 1개월 단위로 단위기간을 만듭니다. 개설 후 반 설정에서 확인할 수 있습니다.</p>
          <div className="overflow-hidden rounded-lg border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-neutral-500">
                <tr>
                  <th className="px-3 py-2 font-medium">단위기간</th>
                  <th className="px-3 py-2 font-medium">기간</th>
                  <th className="px-3 py-2 text-right font-medium">훈련일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {periods.map((p) => (
                  <tr key={p.label}>
                    <td className="px-3 py-2 font-medium text-neutral-900">{p.label}</td>
                    <td className="px-3 py-2 tabular-nums text-neutral-700">{p.startDate} ~ {p.endDate}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{countIn(p.startDate, p.endDate)}일</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <StaffGroup title="매니저" hint="주담당 매니저는 결석계·티켓을 자동으로 배정받습니다." options={managers} selected={staff} onToggle={toggleStaff} primaryId={primaryId} onPrimary={setPrimaryId} />
          <StaffGroup title="강사" options={instructors} selected={staff} onToggle={toggleStaff} />
          <dl className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
            {[
              ["과정명", values.name],
              ["강의실", values.room || "미정"],
              ["훈련 기간", `${values.startDate} ~ ${values.endDate}`],
              ["훈련일", `${trainingCount}일 · 단위기간 ${periods.length}개`],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-4 px-4 py-2.5 text-sm">
                <dt className="w-20 shrink-0 text-neutral-500">{k}</dt>
                <dd className="font-medium text-neutral-900 tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="flex justify-between gap-2 border-t border-neutral-200 pt-4">
        <Button variant="outline" onClick={() => (step === 0 ? router.back() : setStep((s) => s - 1))} disabled={isPending}>
          {step === 0 ? "취소" : "이전"}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={goNext}>다음</Button>
        ) : (
          <Button type="submit" disabled={isPending}>
            {isPending ? "개설하는 중…" : "반 개설하고 명부 등록으로"}
          </Button>
        )}
      </div>
    </form>
  );
}

function StaffGroup({
  title,
  hint,
  options,
  selected,
  onToggle,
  primaryId,
  onPrimary,
}: {
  title: string;
  hint?: string;
  options: StaffOption[];
  selected: number[];
  onToggle: (o: StaffOption) => void;
  primaryId?: number | null;
  onPrimary?: (id: number) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-caption font-medium text-neutral-700">{title}</legend>
      {hint && <p className="text-xs text-neutral-500">{hint}</p>}
      {options.length === 0 ? (
        <p className="text-sm text-neutral-500">배정할 수 있는 {title} 계정이 없습니다. 개설 후 명부 CSV로 발급할 수 있습니다.</p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
          {options.map((o) => {
            const on = selected.includes(o.id);
            return (
              <li key={o.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4 accent-primary-500" checked={on} onChange={() => onToggle(o)} />
                  <span className="font-medium text-neutral-900">{o.name}</span>
                  <span className="text-neutral-500">{o.loginId}</span>
                </label>
                {onPrimary && on && (
                  <label className="flex items-center gap-1.5 text-xs text-neutral-600">
                    <input type="radio" name="primaryManager" className="accent-primary-500" checked={primaryId === o.id} onChange={() => onPrimary(o.id)} />
                    주담당
                  </label>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {hint && <span className="ml-1 font-normal text-neutral-500">({hint})</span>}
      </Label>
      {children}
    </div>
  );
}
