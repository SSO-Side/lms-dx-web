"use client";

// 서브 계정 화면(클라이언트): 서브 관리자 발급(임시 비밀번호 1회 표시), 비밀번호 재설정, 비활성화.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { createSubAccountAction, deactivateSubAccountAction, resetSubAccountPasswordAction } from "@/server/sub-accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Widget } from "@/components/Widget";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export interface SubAccountItem {
  id: number;
  name: string;
  loginId: string;
  phone: string | null;
  status: string;
  lastLoginAt: string | null;
  cohortCount: number;
  primaryCount: number;
}

type Pending = { kind: "reset" | "deactivate"; account: SubAccountItem } | null;

export function SubAccountsManager({ accounts }: { accounts: SubAccountItem[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", loginId: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [tempPassword, setTempPassword] = useState<{ who: string; value: string } | null>(null);

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch {
      setError("처리하지 못했습니다. 권한을 확인하고 다시 시도해 주세요.");
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await run(() => createSubAccountAction({ name: form.name, loginId: form.loginId, phone: form.phone || undefined }));
    if (!res) return;
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.tempPassword) setTempPassword({ who: `${form.name} (${form.loginId})`, value: res.tempPassword });
    setForm({ name: "", loginId: "", phone: "" });
    router.refresh();
  };

  const confirmPending = async () => {
    if (!pending) return;
    const { kind, account } = pending;
    setPending(null);
    const res = await run(() => (kind === "reset" ? resetSubAccountPasswordAction(account.id) : deactivateSubAccountAction(account.id)));
    if (!res) return;
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (kind === "reset" && res.tempPassword) {
      setTempPassword({ who: `${account.name} (${account.loginId})`, value: res.tempPassword });
    }
    router.refresh();
  };

  const columns: Column<SubAccountItem>[] = [
    { header: "이름", cell: (a) => <span className="font-medium">{a.name}</span> },
    { header: "로그인 ID", accessorKey: "loginId" },
    { header: "연락처", cell: (a) => <span className="tabular-nums">{a.phone || "-"}</span> },
    {
      header: "담당 반",
      align: "right",
      cell: (a) => (
        <span className="tabular-nums">
          {a.cohortCount}개{a.primaryCount > 0 && <span className="text-neutral-500"> (주담당 {a.primaryCount})</span>}
        </span>
      ),
    },
    { header: "최근 로그인", cell: (a) => a.lastLoginAt ?? "—", className: "whitespace-nowrap tabular-nums text-neutral-500" },
    { header: "상태", cell: (a) => <StatusBadge domain="userStatus" value={a.status} /> },
    {
      header: <span className="sr-only">관리</span>,
      align: "right",
      cell: (a) =>
        a.status === "ACTIVE" ? (
          <div className="flex justify-end gap-1.5">
            <Button variant="outline" size="xs" onClick={() => setPending({ kind: "reset", account: a })}>
              비밀번호 재설정
            </Button>
            <Button variant="destructive-outline" size="xs" onClick={() => setPending({ kind: "deactivate", account: a })}>
              비활성화
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-5">
      {error && <Alert tone="danger">{error}</Alert>}

      <Widget title="서브 관리자 발급" subtitle="발급하면 임시 비밀번호를 한 번만 보여 줍니다. 첫 로그인 때 비밀번호를 바꿉니다.">
        <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="sub-name">이름</Label>
            <Input id="sub-name" required maxLength={50} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sub-login">로그인 ID</Label>
            <Input
              id="sub-login"
              required
              minLength={3}
              maxLength={50}
              pattern="[a-zA-Z0-9_\-]+"
              value={form.loginId}
              onChange={(e) => setForm({ ...form, loginId: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sub-phone">연락처 (선택)</Label>
            <Input id="sub-phone" maxLength={30} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <Button type="submit" size="sm" disabled={busy || !form.name.trim() || !form.loginId.trim()}>
            <UserPlus aria-hidden />
            {busy ? "처리하는 중…" : "발급"}
          </Button>
        </form>
      </Widget>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">서브 관리자 ({accounts.length}명)</h2>
          <p className="text-sm text-neutral-500">담당 반은 티켓 담당자를 정할 때만 씁니다. 반별 배정은 반의 계정 관리에서 합니다.</p>
        </div>
        <DataTable columns={columns} data={accounts} getRowKey={(a) => a.id} emptyMessage="아직 서브 관리자가 없습니다. 위에서 발급해 주세요." />
      </section>

      {/* 파괴적 동작 확인 모달 (ia.md §3) */}
      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pending?.kind === "reset" ? "임시 비밀번호를 새로 발급할까요?" : "서브 계정을 비활성화할까요?"}</DialogTitle>
            <DialogDescription>
              {pending?.account.name} ({pending?.account.loginId})
              {pending?.kind === "reset"
                ? " — 기존 비밀번호는 더 이상 쓸 수 없고 로그인 중인 기기에서 로그아웃됩니다."
                : " — 비활성화하면 로그인할 수 없습니다. 맡은 모든 반에서 주담당이 풀리고 미완료 티켓은 담당자가 바뀝니다."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              취소
            </Button>
            <Button variant={pending?.kind === "deactivate" ? "destructive" : "default"} onClick={confirmPending}>
              {pending?.kind === "reset" ? "새로 발급" : "비활성화"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={tempPassword !== null} onOpenChange={(open) => !open && setTempPassword(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>임시 비밀번호를 발급했습니다</DialogTitle>
            <DialogDescription>{tempPassword?.who}</DialogDescription>
          </DialogHeader>
          <p className="rounded-lg bg-neutral-100 px-4 py-3 text-center font-mono text-lg font-semibold tracking-wider select-all">
            {tempPassword?.value}
          </p>
          <Alert tone="warning">창을 닫으면 다시 볼 수 없습니다. 복사해서 전달해 주세요.</Alert>
          <DialogFooter>
            <Button onClick={() => setTempPassword(null)}>확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
