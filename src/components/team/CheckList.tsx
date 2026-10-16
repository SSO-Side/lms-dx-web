"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { toggleCheckAction } from "@/server/team";
import type { CheckState } from "@/server/team-queries";
import type { Checkpoint } from "@/lib/team/guide";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

/**
 * 체크포인트·완료 체크리스트. editable이면 항목을 눌러 체크/해제(서버에서 본인 팀·강사 여부를 다시 검사).
 * 체크 상태는 아이콘 + 취소선 없는 "완료 MM-DD" 텍스트로도 표시한다.
 */
export function CheckList({
  cohortId,
  teamId,
  items,
  checks,
  editable,
  comfortable = false,
  onChanged,
}: {
  cohortId: number;
  teamId: number;
  items: Checkpoint[];
  checks: Record<string, CheckState>;
  editable: boolean;
  comfortable?: boolean;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const toggle = (key: string, done: boolean) => {
    setError(null);
    setPendingKey(key);
    startTransition(async () => {
      const res = await toggleCheckAction(cohortId, teamId, key, done);
      setPendingKey(null);
      if (!res.ok) return setError(res.error);
      onChanged?.();
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
        {items.map((c) => {
          const state = checks[c.key];
          const done = !!state?.done;
          const Icon = done ? CheckCircle2 : Circle;
          const content = (
            <>
              <Icon className={cn("mt-0.5 size-5 shrink-0", done ? "text-status-success-solid" : "text-neutral-400")} aria-hidden />
              <span className="min-w-0 flex-1 text-left">
                <span className={cn(done ? "text-neutral-700" : "text-neutral-900")}>{c.label}</span>
                <span className="block text-xs text-neutral-500 tabular-nums">{done ? `완료${state?.doneAt ? ` ${state.doneAt}` : ""}` : "미완료"}</span>
              </span>
            </>
          );
          const rowClass = cn("flex w-full items-start gap-3 px-3", comfortable ? "min-h-14 py-3 text-base" : "min-h-11 py-2 text-sm");
          return (
            <li key={c.key}>
              {editable ? (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={done}
                  disabled={pendingKey !== null}
                  onClick={() => toggle(c.key, !done)}
                  className={cn(rowClass, "hover:bg-neutral-50 disabled:opacity-60")}
                >
                  {content}
                </button>
              ) : (
                <div className={rowClass}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
