"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, FilePlus2, MessageSquarePlus } from "lucide-react";
import { createAbsenceAction, createInquiryAction } from "@/server/tickets";
import type { TicketRow } from "@/server/ticket-queries";
import { TICKET_TYPE_LABELS, ABSENCE_REASON_LABELS } from "@/lib/tickets/labels";
import { formatYmdWithDow } from "@/lib/dates";
import { StatusBadge } from "@/components/StatusBadge";
import { TicketDrawer } from "@/components/tickets/TicketDrawer";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function StudentTickets({
  cohortId,
  tickets,
  trainingDates,
  initialTicketId,
  initialNew,
}: {
  cohortId: number;
  tickets: TicketRow[];
  trainingDates: string[];
  initialTicketId: number | null;
  initialNew?: "absence" | "inquiry" | null;
}) {
  const [openId, setOpenId] = useState<number | null>(initialTicketId);
  const [sheet, setSheet] = useState<"absence" | "inquiry" | null>(initialNew ?? null);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Button size="lg" onClick={() => setSheet("absence")}>
          <FilePlus2 /> 결석계 접수
        </Button>
        <Button size="lg" variant="outline" onClick={() => setSheet("inquiry")}>
          <MessageSquarePlus /> 문의 등록
        </Button>
      </div>

      {tickets.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-card px-4 py-10 text-center text-sm text-neutral-500">
          아직 접수한 티켓이 없습니다.
        </div>
      ) : (
        <ul className="divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 bg-card">
          {tickets.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setOpenId(t.id)}
                className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-neutral-900">{t.title}</p>
                  <p className="mt-0.5 text-xs text-neutral-500 tabular-nums">
                    {TICKET_TYPE_LABELS[t.type]} · 접수 {t.createdAt}
                  </p>
                </div>
                <StatusBadge domain="ticket" value={t.status} />
                <ChevronRight className="size-4 shrink-0 text-neutral-400" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <TicketDrawer cohortId={cohortId} ticketId={openId} onClose={() => setOpenId(null)} />
      <AbsenceSheet
        cohortId={cohortId}
        open={sheet === "absence"}
        trainingDates={trainingDates}
        onClose={() => setSheet(null)}
        onCreated={(id) => {
          setSheet(null);
          setOpenId(id);
        }}
      />
      <InquirySheet
        cohortId={cohortId}
        open={sheet === "inquiry"}
        onClose={() => setSheet(null)}
        onCreated={(id) => {
          setSheet(null);
          setOpenId(id);
        }}
      />
    </div>
  );
}

const STEPS = ["일자", "사유", "증빙", "확인"] as const;
const ACCEPT = "image/jpeg,image/png,image/heic,image/heif,.heic,application/pdf";

/** 결석계 접수: 하단 드로어 안의 단계형 폼 (ia.md §3) */
function AbsenceSheet({
  cohortId,
  open,
  trainingDates,
  onClose,
  onCreated,
}: {
  cohortId: number;
  open: boolean;
  trainingDates: string[];
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState<"SICK" | "LEAVE" | "OTHER" | "">("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setStep(0);
    setDate("");
    setReason("");
    setBody("");
    setFiles([]);
    setError(null);
  };

  const next = () => {
    setError(null);
    if (step === 0 && !trainingDates.includes(date)) return setError("훈련일을 선택해 주세요. 주말·휴강일은 접수할 수 없습니다.");
    if (step === 1 && !reason) return setError("사유 유형을 선택해 주세요.");
    if (step === 2) {
      if (files.length > 3) return setError("증빙은 최대 3개까지 첨부할 수 있습니다.");
      if (files.some((f) => f.size > 10 * 1024 * 1024)) return setError("파일당 10MB 이하만 첨부할 수 있습니다.");
    }
    setStep((s) => s + 1);
  };

  const submit = () => {
    const fd = new FormData();
    fd.set("absentDate", date);
    fd.set("reasonType", reason);
    fd.set("body", body);
    files.forEach((f) => fd.append("files", f));
    setError(null);
    startTransition(async () => {
      const res = await createAbsenceAction(cohortId, fd);
      if (!res.ok) return setError(res.error);
      reset();
      router.refresh();
      if (res.ticketId) onCreated(res.ticketId);
    });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          reset();
        }
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>결석계 접수</SheetTitle>
          <SheetDescription>
            {step + 1}/{STEPS.length} · {STEPS[step]}
          </SheetDescription>
          <ol className="flex gap-1 pt-1" aria-hidden>
            {STEPS.map((s, i) => (
              <li key={s} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-primary-500" : "bg-neutral-200")} />
            ))}
          </ol>
        </SheetHeader>
        <SheetBody className="space-y-4">
          {step === 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="ab-date">결석 일자</Label>
              <Input
                id="ab-date"
                type="date"
                className="h-12 text-base"
                value={date}
                min={trainingDates[0]}
                max={trainingDates[trainingDates.length - 1]}
                onChange={(e) => setDate(e.target.value)}
              />
              {date && (
                <p className={cn("text-sm", trainingDates.includes(date) ? "text-neutral-600" : "text-status-danger-fg")}>
                  {formatYmdWithDow(date)} {trainingDates.includes(date) ? "· 훈련일" : "· 훈련일이 아닙니다"}
                </p>
              )}
            </div>
          )}
          {step === 1 && (
            <fieldset className="space-y-2">
              <legend className="mb-1 text-caption font-medium text-neutral-700">사유 유형</legend>
              {(["SICK", "LEAVE", "OTHER"] as const).map((r) => (
                <label
                  key={r}
                  className={cn(
                    "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-4 text-base",
                    reason === r ? "border-primary-500 bg-primary-50" : "border-neutral-200"
                  )}
                >
                  <input type="radio" name="reason" className="size-4 accent-primary-500" checked={reason === r} onChange={() => setReason(r)} />
                  <span>
                    {ABSENCE_REASON_LABELS[r]}
                    {r === "OTHER" && <span className="ml-1 text-xs text-neutral-500">(공결로 처리되지 않습니다)</span>}
                  </span>
                </label>
              ))}
              <div className="space-y-1.5 pt-2">
                <Label htmlFor="ab-body">상세 내용 (선택)</Label>
                <Textarea id="ab-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} />
              </div>
            </fieldset>
          )}
          {step === 2 && (
            <div className="space-y-2">
              <Label htmlFor="ab-files">증빙 사진·파일 (선택, 권장)</Label>
              <input
                id="ab-files"
                type="file"
                multiple
                accept={ACCEPT}
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                className="block w-full text-sm text-neutral-600 file:mr-3 file:h-11 file:rounded-md file:border-0 file:bg-primary-50 file:px-4 file:text-sm file:font-medium file:text-primary-700"
              />
              <p className="text-xs text-neutral-500">진단서·확인서 사진(jpg, png, heic) 또는 pdf · 파일당 10MB · 최대 3개</p>
              {files.length > 0 && (
                <ul className="space-y-1 text-sm text-neutral-700">
                  {files.map((f) => (
                    <li key={f.name} className="flex justify-between gap-2">
                      <span className="truncate">{f.name}</span>
                      <span className="shrink-0 text-neutral-500 tabular-nums">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {step === 3 && (
            <dl className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 text-sm">
              {[
                ["결석 일자", formatYmdWithDow(date)],
                ["사유", reason ? ABSENCE_REASON_LABELS[reason] : ""],
                ["증빙", files.length ? `${files.length}개` : "없음"],
                ["상세 내용", body || "없음"],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-3 px-4 py-3">
                  <dt className="w-20 shrink-0 text-neutral-500">{k}</dt>
                  <dd className="min-w-0 break-words text-neutral-900">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {error && <Alert tone="danger">{error}</Alert>}
        </SheetBody>
        <SheetFooter>
          <Button size="lg" variant="outline" onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))} disabled={pending}>
            {step === 0 ? "취소" : "이전"}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button size="lg" onClick={next}>
              다음
            </Button>
          ) : (
            <Button size="lg" onClick={submit} disabled={pending}>
              <Check /> {pending ? "접수하는 중…" : "접수"}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function InquirySheet({
  cohortId,
  open,
  onClose,
  onCreated,
}: {
  cohortId: number;
  open: boolean;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (fd: FormData) => {
    setError(null);
    startTransition(async () => {
      const res = await createInquiryAction(cohortId, fd);
      if (!res.ok) return setError(res.error);
      router.refresh();
      if (res.ticketId) onCreated(res.ticketId);
    });
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <form action={submit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>문의 등록</SheetTitle>
            <SheetDescription>상담·서류 발급 등 요청을 담당 매니저에게 보냅니다.</SheetDescription>
          </SheetHeader>
          <SheetBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="iq-type">유형</Label>
              <select
                id="iq-type"
                name="type"
                defaultValue="COUNSELING"
                className="h-12 w-full rounded-md border border-neutral-300 bg-card px-3 text-base"
              >
                <option value="COUNSELING">상담</option>
                <option value="DOCUMENT">서류</option>
                <option value="OTHER">기타</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="iq-title">제목</Label>
              <Input id="iq-title" name="title" required maxLength={200} className="h-12 text-base" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="iq-body">내용</Label>
              <Textarea id="iq-body" name="body" maxLength={5000} className="min-h-32" />
            </div>
            {error && <Alert tone="danger">{error}</Alert>}
          </SheetBody>
          <SheetFooter>
            <Button size="lg" variant="outline" onClick={onClose}>
              취소
            </Button>
            <Button size="lg" type="submit" disabled={pending}>
              {pending ? "등록하는 중…" : "등록"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
