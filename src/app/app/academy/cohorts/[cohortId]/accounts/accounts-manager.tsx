"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Role } from "@prisma/client";
import { AlertCircle, CheckCircle2, Download, FileUp } from "lucide-react";
import {
  parseRosterCSVAction,
  bulkIssueAccountsAction,
  resetPasswordAction,
  deactivateAccountAction,
} from "@/server/academy";
import type { ParsedAccountRow } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
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

const ROLE_LABEL: Partial<Record<Role, string>> = { STUDENT: "수강생", INSTRUCTOR: "강사", MANAGER: "매니저" };

interface MemberItem {
  id: number;
  name: string;
  loginId: string;
  phone: string | null;
  role: Role;
  status: string;
}

type SkippedRow = { line: number; name: string; loginId: string; reason: string };

type Pending = { kind: "reset" | "deactivate"; member: MemberItem } | null;

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const SAMPLE_CSV =
  "﻿이름,로그인ID,연락처,역할\n홍길동,hong_kdt,010-0000-0001,STUDENT\n김강사,kim_inst,010-0000-0002,INSTRUCTOR\n이매니저,lee_mgr,010-0000-0003,MANAGER\n";

export function AccountsManager({ cohortId, initialMembers }: { cohortId: number; initialMembers: MemberItem[] }) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [step, setStep] = useState<"upload" | "preview" | "issued">("upload");
  const [csvText, setCsvText] = useState("");
  const [rows, setRows] = useState<ParsedAccountRow[]>([]);
  const [issued, setIssued] = useState<{ csv: string; count: number; skipped: SkippedRow[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [tempPassword, setTempPassword] = useState<{ who: string; value: string } | null>(null);

  const validCount = rows.filter((r) => !r.error).length;

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

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(String(ev.target?.result ?? ""));
    reader.readAsText(file, "utf-8");
  };

  const handleParse = async () => {
    const res = await run(() => parseRosterCSVAction(cohortId, csvText));
    if (res) {
      setRows(res.rows);
      setStep("preview");
    }
  };

  const handleIssue = async () => {
    const res = await run(() => bulkIssueAccountsAction(cohortId, rows.filter((r) => !r.error)));
    if (!res) return;
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    if ("csvContent" in res && res.csvContent) {
      setIssued({ csv: res.csvContent, count: res.issuedCount ?? 0, skipped: res.skipped ?? [] });
      setStep("issued");
    }
  };

  const confirmPending = async () => {
    if (!pending) return;
    const { kind, member } = pending;
    setPending(null);
    if (kind === "reset") {
      const res = await run(() => resetPasswordAction(cohortId, member.id));
      if (res && "tempPassword" in res && res.tempPassword) {
        setTempPassword({ who: `${member.name} (${member.loginId})`, value: res.tempPassword });
      } else if (res && "error" in res && res.error) {
        setError(res.error);
      }
    } else {
      const res = await run(() => deactivateAccountAction(cohortId, member.id));
      if (res && "success" in res && res.success) {
        setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, status: "INACTIVE" } : m)));
      } else if (res && "error" in res && res.error) {
        setError(res.error);
      }
    }
  };

  const resetUpload = () => {
    setStep("upload");
    setCsvText("");
    setRows([]);
    setIssued(null);
    router.refresh();
  };

  const previewColumns: Column<ParsedAccountRow>[] = [
    { header: "행", align: "right", cell: (r) => <span className="tabular-nums text-neutral-500">{r.line}</span> },
    { header: "이름", accessorKey: "name" },
    { header: "로그인 ID", accessorKey: "loginId" },
    { header: "역할", cell: (r) => ROLE_LABEL[r.role] ?? r.role },
    { header: "연락처", cell: (r) => r.phone || "-" },
    {
      header: "검증",
      cell: (r) =>
        r.error ? (
          <span className="inline-flex items-center gap-1 text-status-danger-fg">
            <AlertCircle className="size-4 text-status-danger-solid" aria-hidden />
            {r.error}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-status-success-fg">
            <CheckCircle2 className="size-4 text-status-success-solid" aria-hidden />
            정상
          </span>
        ),
    },
  ];

  const skippedColumns: Column<SkippedRow>[] = [
    { header: "행", align: "right", cell: (r) => <span className="tabular-nums text-neutral-500">{r.line}</span> },
    { header: "이름", accessorKey: "name" },
    { header: "로그인 ID", accessorKey: "loginId" },
    { header: "사유", accessorKey: "reason" },
  ];

  const memberColumns: Column<MemberItem>[] = [
    { header: "이름", cell: (m) => <span className="font-medium">{m.name}</span> },
    { header: "로그인 ID", accessorKey: "loginId" },
    { header: "역할", cell: (m) => <Badge variant={m.role === "STUDENT" ? "secondary" : "default"}>{ROLE_LABEL[m.role] ?? m.role}</Badge> },
    { header: "연락처", cell: (m) => <span className="tabular-nums">{m.phone || "-"}</span> },
    { header: "상태", cell: (m) => <StatusBadge domain="userStatus" value={m.status} /> },
    {
      header: <span className="sr-only">관리</span>,
      align: "right",
      cell: (m) => (
        <div className="flex justify-end gap-1.5">
          <Button variant="outline" size="xs" onClick={() => setPending({ kind: "reset", member: m })}>
            비밀번호 재설정
          </Button>
          {m.status === "ACTIVE" && (
            <Button variant="destructive-outline" size="xs" onClick={() => setPending({ kind: "deactivate", member: m })}>
              비활성화
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {error && <Alert tone="danger">{error}</Alert>}

      <Widget
        title="명부 CSV로 계정 일괄 발급"
        subtitle="헤더: 이름,로그인ID,연락처,역할 (역할은 STUDENT, INSTRUCTOR, MANAGER)"
        action={
          <Button variant="ghost" size="xs" onClick={() => downloadCsv(SAMPLE_CSV, "roster_sample.csv")}>
            <Download aria-hidden />
            샘플 CSV
          </Button>
        }
      >
        {step === "upload" && (
          <div className="space-y-3">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-5 text-sm text-neutral-600 hover:border-primary-400 hover:bg-primary-50">
              <FileUp className="size-5 text-neutral-500" aria-hidden />
              CSV 파일 선택
              <input type="file" accept=".csv,text/csv" onChange={handleFile} className="sr-only" />
            </label>
            <Textarea
              aria-label="CSV 내용"
              className="h-32 font-mono text-xs"
              placeholder={"또는 여기에 붙여 넣기\n이름,로그인ID,연락처,역할"}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={handleParse} disabled={!csvText.trim() || busy}>
                {busy ? "검증하는 중…" : "검증하고 미리보기"}
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 text-sm">
              <p className="text-neutral-600">
                {rows.length}행 중 <strong className="font-semibold text-primary-700">{validCount}행</strong> 발급 가능
              </p>
              <Button variant="outline" size="xs" onClick={() => setStep("upload")}>
                다시 올리기
              </Button>
            </div>
            <DataTable columns={previewColumns} data={rows} getRowKey={(r) => r.line} />
            <div className="flex justify-end">
              <Button size="sm" onClick={handleIssue} disabled={validCount === 0 || busy}>
                {busy ? "발급하는 중…" : `오류 행을 빼고 ${validCount}명 발급`}
              </Button>
            </div>
          </div>
        )}

        {step === "issued" && issued && (
          <div className="space-y-3">
            <Alert tone="success">{issued.count}명의 계정을 발급했습니다.</Alert>
            {issued.skipped.length > 0 && (
              <div className="space-y-2">
                <Alert tone="warning">
                  {issued.skipped.length}행은 발급하지 않고 건너뛰었습니다. 로그인 ID를 바꿔 다시 올려 주세요.
                </Alert>
                <DataTable columns={skippedColumns} data={issued.skipped} getRowKey={(r) => r.line} />
              </div>
            )}
            <Alert tone="warning">
              임시 비밀번호는 서버에 남지 않아 이 화면을 벗어나면 다시 볼 수 없습니다. 지금 내려받아 전달해 주세요.
            </Alert>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => downloadCsv(issued.csv, `cohort_${cohortId}_temp_passwords.csv`)}>
                <Download aria-hidden />
                임시 비밀번호 CSV 내려받기
              </Button>
              <Button variant="outline" size="sm" onClick={resetUpload}>
                완료
              </Button>
            </div>
          </div>
        )}
      </Widget>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">등록 명부 ({members.length}명)</h2>
          <p className="text-sm text-neutral-500">비밀번호를 잃어버린 사용자는 재설정하고, 퇴소자는 비활성화합니다.</p>
        </div>
        <DataTable
          columns={memberColumns}
          data={members}
          getRowKey={(m) => m.id}
          emptyMessage="아직 등록된 인원이 없습니다. 위에서 명부 CSV를 올려 주세요."
        />
      </section>

      {/* 파괴적 동작 확인 모달 (ia.md §3) */}
      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pending?.kind === "reset" ? "임시 비밀번호를 새로 발급할까요?" : "계정을 비활성화할까요?"}</DialogTitle>
            <DialogDescription>
              {pending?.member.name} ({pending?.member.loginId})
              {pending?.kind === "reset"
                ? " — 기존 비밀번호는 더 이상 쓸 수 없습니다."
                : " — 비활성화하면 로그인할 수 없습니다."}
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
