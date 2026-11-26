"use client";

// 계정 관리 > 담당 교직원(클라이언트): 같은 학원의 매니저·강사 배정·해제, 주담당 매니저 지정.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Role, StaffRole } from "@prisma/client";
import { assignStaffAction, removeStaffAction, setPrimaryManagerAction } from "@/server/academy";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Widget } from "@/components/Widget";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const ROLE_LABEL: Record<StaffRole, string> = { MANAGER: "매니저", INSTRUCTOR: "강사" };
const selectCls = "h-10 w-full rounded-md border border-neutral-300 bg-card px-3 text-sm text-neutral-900";

interface AssignedStaff {
  userId: number;
  staffRole: StaffRole;
  isPrimary: boolean;
  name: string;
  loginId: string;
  status: string;
}

interface StaffCandidate {
  id: number;
  name: string;
  loginId: string;
  role: Role;
}

type ActionResult = Awaited<ReturnType<typeof removeStaffAction>>;

export function StaffManager({
  cohortId,
  assigned,
  candidates,
}: {
  cohortId: number;
  assigned: AssignedStaff[];
  candidates: StaffCandidate[];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [selected, setSelected] = useState("");
  const [removing, setRemoving] = useState<AssignedStaff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const hasPrimary = assigned.some((s) => s.isPrimary && s.status === "ACTIVE");

  const run = (fn: () => Promise<ActionResult>, done: (movedTickets: number) => string) => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const res = await fn();
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setNotice(done(res.movedTickets ?? 0));
        setSelected("");
        router.refresh();
      } catch {
        setError("처리하지 못했습니다. 권한을 확인하고 다시 시도해 주세요.");
      }
    });
  };

  const columns: Column<AssignedStaff>[] = [
    {
      header: "이름",
      cell: (s) => (
        <span className="inline-flex items-center gap-1.5">
          <span className="font-medium">{s.name}</span>
          {s.isPrimary && <Badge>주담당</Badge>}
        </span>
      ),
    },
    { header: "로그인 ID", accessorKey: "loginId" },
    { header: "역할", cell: (s) => ROLE_LABEL[s.staffRole] },
    { header: "상태", cell: (s) => <StatusBadge domain="userStatus" value={s.status} /> },
    {
      header: <span className="sr-only">관리</span>,
      align: "right",
      cell: (s) => (
        <div className="flex justify-end gap-1.5">
          {s.staffRole === "MANAGER" && !s.isPrimary && s.status === "ACTIVE" && (
            <Button
              variant="outline"
              size="xs"
              disabled={busy}
              onClick={() => run(() => setPrimaryManagerAction(cohortId, s.userId), () => `${s.name} 님을 주담당으로 지정했습니다.`)}
            >
              주담당 지정
            </Button>
          )}
          <Button variant="destructive-outline" size="xs" disabled={busy} onClick={() => setRemoving(s)}>
            담당 해제
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Widget title="담당 교직원" subtitle="같은 학원의 매니저·강사를 배정합니다. 새 계정은 아래 명부 CSV로 발급합니다.">
      <div className="space-y-3">
        {error && <Alert tone="danger">{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}
        {!hasPrimary && (
          <Alert tone="warning">주담당 매니저가 없습니다. 새 티켓은 담당자 없이 접수되어 학원 관리자가 처리합니다.</Alert>
        )}
        <DataTable columns={columns} data={assigned} getRowKey={(s) => s.userId} emptyMessage="아직 배정된 담당자가 없습니다." />
        {candidates.length > 0 ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              aria-label="추가할 담당자"
              className={`${selectCls} sm:max-w-xs`}
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">추가할 담당자 선택</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.loginId}) · {c.role === "MANAGER" ? ROLE_LABEL.MANAGER : ROLE_LABEL.INSTRUCTOR}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              disabled={!selected || busy}
              onClick={() => run(() => assignStaffAction(cohortId, Number(selected)), () => "담당자를 배정했습니다.")}
            >
              배정
            </Button>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">추가할 수 있는 매니저·강사가 없습니다.</p>
        )}
      </div>

      <Dialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>담당에서 해제할까요?</DialogTitle>
            <DialogDescription>
              {removing?.name} ({removing?.loginId}) — 해제하면 이 반에 들어올 수 없습니다. 맡고 있던 미완료 티켓은{" "}
              {hasPrimary && !removing?.isPrimary
                ? "주담당 매니저에게 넘어갑니다."
                : "담당자가 비워져 학원 관리자가 처리합니다. 다른 매니저에게 넘기려면 먼저 주담당을 바꿔 주세요."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!removing) return;
                const target = removing;
                setRemoving(null);
                run(
                  () => removeStaffAction(cohortId, target.userId),
                  (moved) => `${target.name} 님을 담당에서 해제했습니다.${moved ? ` 미완료 티켓 ${moved}건의 담당자를 바꿨습니다.` : ""}`
                );
              }}
            >
              담당 해제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Widget>
  );
}
