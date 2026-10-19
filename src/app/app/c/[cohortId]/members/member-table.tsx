"use client";

// 명부 표(클라이언트): 수강생 목록과 재적 상태(수강·중도 탈락 등) 변경.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EnrollmentStatus } from "@prisma/client";
import { updateEnrollmentStatusAction } from "@/server/cohort";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export type MemberRow = {
  userId: number;
  name: string;
  loginId: string;
  phone: string | null;
  roleLabel: string;
  isStudent: boolean;
  enrollmentStatus: EnrollmentStatus | null;
  accountStatus: string;
  lastLoginAt: string | null;
};

const STATUS_OPTIONS: { value: EnrollmentStatus; label: string }[] = [
  { value: "ENROLLED", label: "재적" },
  { value: "DROPPED", label: "이탈" },
  { value: "COMPLETED", label: "수료" },
];

export function MemberTable({ cohortId, rows }: { cohortId: number; rows: MemberRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<MemberRow | null>(null);
  const [confirm, setConfirm] = useState<EnrollmentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const columns: Column<MemberRow>[] = [
    { header: "이름", cell: (r) => <span className="font-medium text-neutral-900">{r.name}</span> },
    { header: "로그인 ID", cell: (r) => r.loginId, className: "text-neutral-600" },
    { header: "역할", cell: (r) => r.roleLabel, className: "whitespace-nowrap" },
    {
      header: "상태",
      cell: (r) =>
        r.enrollmentStatus ? (
          <StatusBadge domain="enrollment" value={r.enrollmentStatus} />
        ) : (
          <StatusBadge domain="userStatus" value={r.accountStatus} />
        ),
    },
    { header: "최근 로그인", cell: (r) => r.lastLoginAt ?? "—", className: "whitespace-nowrap tabular-nums text-neutral-500" },
  ];

  const apply = () => {
    if (!selected || !confirm) return;
    setError(null);
    startTransition(async () => {
      const res = await updateEnrollmentStatusAction(cohortId, selected.userId, confirm);
      if (!res.ok) return setError(res.error);
      setSelected({ ...selected, enrollmentStatus: confirm });
      setConfirm(null);
      router.refresh();
    });
  };

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        getRowKey={(r) => `${r.isStudent ? "s" : "t"}${r.userId}`}
        onRowClick={setSelected}
        emptyMessage="명부가 비어 있습니다."
      />

      <Sheet open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selected?.name}</SheetTitle>
            <SheetDescription>{selected?.roleLabel}</SheetDescription>
          </SheetHeader>
          {selected && (
            <SheetBody className="space-y-5">
              <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2 text-sm">
                <dt className="text-neutral-500">로그인 ID</dt>
                <dd>{selected.loginId}</dd>
                <dt className="text-neutral-500">연락처</dt>
                <dd>{selected.phone ?? "—"}</dd>
                <dt className="text-neutral-500">계정</dt>
                <dd>
                  <StatusBadge domain="userStatus" value={selected.accountStatus} />
                </dd>
                <dt className="text-neutral-500">최근 로그인</dt>
                <dd className="tabular-nums">{selected.lastLoginAt ?? "—"}</dd>
              </dl>
              {selected.isStudent && (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-neutral-900">재적 상태</h3>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((o) => (
                      <Button
                        key={o.value}
                        variant={selected.enrollmentStatus === o.value ? "default" : "outline"}
                        size="sm"
                        disabled={selected.enrollmentStatus === o.value}
                        onClick={() => setConfirm(o.value)}
                      >
                        {o.label}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-neutral-500">이탈·수료로 바꾸면 출결 명부와 수강생 화면 접근에서 제외됩니다.</p>
                </section>
              )}
            </SheetBody>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>재적 상태를 바꿀까요?</DialogTitle>
            <DialogDescription>
              {selected?.name} → {STATUS_OPTIONS.find((o) => o.value === confirm)?.label}
            </DialogDescription>
          </DialogHeader>
          {error && <Alert tone="danger">{error}</Alert>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              취소
            </Button>
            <Button variant={confirm === "DROPPED" ? "destructive" : "default"} onClick={apply} disabled={pending}>
              변경
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
