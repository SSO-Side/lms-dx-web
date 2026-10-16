"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UsersRound } from "lucide-react";
import type { TeamCandidate, TeamRow } from "@/server/team-queries";
import { createTeamAction } from "@/server/team";
import { STAGES, type StageNo } from "@/lib/team/guide";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { TeamDetailDrawer } from "@/components/team/TeamDetailDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/** 팀 목록 표 (강사: 관리, 매니저·슈퍼어드민: 열람). 행 클릭 → 팀 상세 드로어 */
export function TeamBoard({
  cohortId,
  rows,
  expected,
  canManage,
  candidates,
}: {
  cohortId: number;
  rows: TeamRow[];
  expected: StageNo;
  canManage: boolean;
  candidates: TeamCandidate[];
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <>
      {canManage && (
        <div className="mb-3 flex justify-end">
          <Button onClick={() => setCreating(true)}>
            <UsersRound /> 팀 만들기
          </Button>
        </div>
      )}
      <DataTable
        data={rows}
        getRowKey={(r) => r.id}
        onRowClick={(r) => setOpenId(r.id)}
        emptyMessage={canManage ? "아직 팀이 없습니다. [팀 만들기]로 팀장과 팀원을 배정하세요." : "아직 등록된 팀이 없습니다."}
        columns={[
          {
            header: "팀",
            cell: (r) => (
              <span className="block min-w-0">
                <span className="font-medium text-neutral-900">{r.name}</span>
                <span className="block truncate text-xs text-neutral-500">{r.projectTitle}</span>
              </span>
            ),
          },
          { header: "팀장", cell: (r) => r.leaderName, className: "whitespace-nowrap" },
          { header: "인원", cell: (r) => `${r.memberCount}명`, align: "right", className: "hidden sm:table-cell tabular-nums" },
          { header: "현재 단계", cell: (r) => <StatusBadge domain="teamStage" value={String(r.stage)} /> },
          {
            header: "체크포인트",
            cell: (r) => `${r.stageDone}/${r.stageTotal}`,
            align: "right",
            className: "hidden md:table-cell tabular-nums",
          },
          {
            header: `목표(${expected}단계) 대비`,
            cell: (r) => <StatusBadge domain="teamPace" value={r.behind ? "BEHIND" : "ON_TRACK"} />,
          },
          {
            header: "최근 로그",
            cell: (r) => r.lastLogAt ?? <span className="text-neutral-500">없음</span>,
            className: "hidden sm:table-cell whitespace-nowrap tabular-nums text-neutral-600",
          },
        ]}
      />
      <TeamDetailDrawer cohortId={cohortId} teamId={openId} canManage={canManage} onClose={() => setOpenId(null)} />
      {canManage && (
        <CreateTeamSheet
          cohortId={cohortId}
          open={creating}
          candidates={candidates}
          expected={expected}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            setOpenId(id);
          }}
        />
      )}
    </>
  );
}

/** 팀 만들기: 팀명·프로젝트명, 팀장, 팀원 직접 배정, 초기 단계(반 중반이면 이전 단계는 현황 등록으로 완료 처리) */
function CreateTeamSheet({
  cohortId,
  open,
  candidates,
  expected,
  onClose,
  onCreated,
}: {
  cohortId: number;
  open: boolean;
  candidates: TeamCandidate[];
  expected: StageNo;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [leaderId, setLeaderId] = useState<number | null>(null);
  const [members, setMembers] = useState<number[]>([]);
  const [stage, setStage] = useState<StageNo>(expected);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const free = candidates.filter((c) => !c.teamName);

  const reset = () => {
    setName("");
    setTitle("");
    setLeaderId(null);
    setMembers([]);
    setStage(expected);
    setError(null);
  };

  const toggleMember = (id: number) => setMembers((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));

  const submit = () => {
    setError(null);
    if (!name.trim()) return setError("팀 이름을 입력해 주세요.");
    if (!title.trim()) return setError("프로젝트 이름을 입력해 주세요.");
    if (!leaderId) return setError("팀장을 선택해 주세요.");
    startTransition(async () => {
      const res = await createTeamAction(cohortId, { name, projectTitle: title, leaderId, memberIds: members.filter((m) => m !== leaderId), stage });
      if (!res.ok) return setError(res.error);
      reset();
      router.refresh();
      if (res.teamId) onCreated(res.teamId);
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
          <SheetTitle>팀 만들기</SheetTitle>
          <SheetDescription>팀장과 팀원을 직접 배정합니다. 한 수강생은 한 팀에만 속합니다.</SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="team-name">팀 이름</Label>
            <Input id="team-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="예: 3팀 오늘의집밥" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="team-title">프로젝트 이름</Label>
            <Input
              id="team-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="예: 자취생 냉장고 재료 기반 레시피 추천"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="team-leader">팀장</Label>
            <select
              id="team-leader"
              value={leaderId ?? ""}
              onChange={(e) => setLeaderId(e.target.value ? Number(e.target.value) : null)}
              className="h-9 w-full rounded-md border border-neutral-300 bg-card px-3 text-sm"
            >
              <option value="">선택</option>
              {free.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.loginId})
                </option>
              ))}
            </select>
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-neutral-900">
              팀원 <span className="font-normal text-neutral-500">({members.filter((m) => m !== leaderId).length}명 선택)</span>
            </legend>
            {candidates.length === 0 ? (
              <p className="text-sm text-neutral-500">재적 수강생이 없습니다.</p>
            ) : (
              <ul className="max-h-60 divide-y divide-neutral-200 overflow-y-auto rounded-lg border border-neutral-200">
                {candidates.map((c) => {
                  const taken = !!c.teamName;
                  const isLeader = c.id === leaderId;
                  return (
                    <li key={c.id}>
                      <label
                        className={cn(
                          "flex min-h-10 items-center gap-3 px-3 text-sm",
                          taken || isLeader ? "text-neutral-500" : "cursor-pointer hover:bg-neutral-50"
                        )}
                      >
                        <input
                          type="checkbox"
                          className="size-4 accent-primary-500"
                          disabled={taken || isLeader}
                          checked={isLeader || members.includes(c.id)}
                          onChange={() => toggleMember(c.id)}
                        />
                        <span className="flex-1">
                          {c.name} <span className="text-xs text-neutral-500">{c.loginId}</span>
                        </span>
                        {isLeader && <span className="text-xs">팀장</span>}
                        {taken && <span className="text-xs">{c.teamName} 소속</span>}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </fieldset>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-neutral-900">시작 단계</legend>
            <div className="grid grid-cols-2 gap-2">
              {STAGES.map((s) => (
                <label
                  key={s.stage}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                    stage === s.stage ? "border-primary-500 bg-primary-50 text-primary-700" : "border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                  )}
                >
                  <input type="radio" name="team-stage" className="accent-primary-500" checked={stage === s.stage} onChange={() => setStage(s.stage)} />
                  {s.stage}. {s.name}
                </label>
              ))}
            </div>
            <p className="text-xs text-neutral-500">
              진행 중인 프로젝트는 현재 단계를 고르세요. 이전 단계 체크포인트는 &quot;현황 등록&quot;으로 완료 처리됩니다. 오늘 기준 목표는 {expected}
              단계입니다.
            </p>
          </fieldset>
          {error && <Alert tone="danger">{error}</Alert>}
        </SheetBody>
        <SheetFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "만드는 중…" : "팀 만들기"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
