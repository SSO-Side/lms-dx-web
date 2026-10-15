"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { createCohortAction } from "@/server/academy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

// ia.md §3 마법사 중 ① 기본 정보 ② 일정만 서버가 받는다. 요일별 시간·휴강일, 단위기간, 담당자 배정 단계는 M3에서 서버 지원과 함께 추가한다.
const STEPS = ["기본 정보", "일정", "확인"] as const;

export function NewCohortForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState({ name: "", trainingType: "K-Digital Training", room: "", startDate: "", endDate: "" });
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

  const goNext = () => {
    const section = formRef.current?.querySelector<HTMLElement>(`[data-step="${step}"]`);
    const invalid = section?.querySelector<HTMLInputElement>("input:invalid");
    if (invalid) {
      invalid.reportValidity();
      return;
    }
    if (step === 1 && values.startDate && values.endDate && values.endDate < values.startDate) {
      setStepError("종료일은 시작일 이후여야 합니다.");
      return;
    }
    setStepError(null);
    setStep((s) => s + 1);
  };

  return (
    <form ref={formRef} action={formAction} className="space-y-6" noValidate={false}>
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
            <span className={cn("text-sm", i === step ? "font-medium text-neutral-900" : "text-neutral-500")}>{label}</span>
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

      <div data-step="1" className={cn("space-y-4", step !== 1 && "hidden")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="startDate" label="훈련 시작일">
            <Input id="startDate" name="startDate" type="date" value={values.startDate} onChange={set("startDate")} required />
          </Field>
          <Field id="endDate" label="훈련 종료일">
            <Input id="endDate" name="endDate" type="date" value={values.endDate} onChange={set("endDate")} min={values.startDate || undefined} required />
          </Field>
        </div>
        <p className="text-sm text-neutral-500">
          요일별 훈련 시간은 기본값(월~목 09:00~17:40, 금 09:00~16:40)으로 등록됩니다. 휴강일과 단위기간은 반 설정에서 지정합니다.
        </p>
      </div>

      {step === 2 && (
        <dl className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
          {[
            ["과정명", values.name],
            ["훈련 직종", values.trainingType || "K-Digital Training"],
            ["강의실", values.room || "미정"],
            ["훈련 기간", `${values.startDate} ~ ${values.endDate}`],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-4 px-4 py-3 text-sm">
              <dt className="w-24 shrink-0 text-neutral-500">{k}</dt>
              <dd className="font-medium text-neutral-900 tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
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
