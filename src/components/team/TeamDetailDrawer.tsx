"use client";

// 팀 상세 드로어(교직원): 팀원·단계·체크리스트·피드백·로그, 단계 승인과 피드백 작성.
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightCircle, MessageSquarePlus } from "lucide-react";
import { getTeamDetailAction, addFeedbackAction, advanceStageAction } from "@/server/team";
import type { TeamDetail } from "@/server/team-queries";
import { COMPLETION_CHECKLIST, completionDone, stageGuide } from "@/lib/team/guide";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { TeamStageSteps } from "./TeamStageSteps";
import { CheckList } from "./CheckList";
import { FeedbackList, LogList, ProjectPlanView } from "./TeamHistory";
import { cn } from "@/lib/utils";

type Tab = "plan" | "check" | "log" | "feedback";
const TABS: Array<{ key: Tab; label: string }> = [
  { key: "plan", label: "기획안" },
  { key: "check", label: "마일스톤" },
  { key: "log", label: "주간 로그" },
  { key: "feedback", label: "피드백" },
];

/**
 * 팀 상세 드로어 (강사·매니저). canManage(강사·ADMIN)이면 마일스톤 체크, 피드백 작성, 단계 승인 가능.
 * 매니저·슈퍼어드민은 열람만. teamId가 null이면 닫힘.
 */
export function TeamDetailDrawer({
  cohortId,
  teamId,
  canManage,
  onClose,
}: {
  cohortId: number;
  teamId: number | null;
  canManage: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<TeamDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("plan");
  const [comment, setComment] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (teamId === null) return;
    let alive = true;
    setError(null);
    getTeamDetailAction(cohortId, teamId).then((res) => {
      if (!alive) return;
      if (res.ok) setDetail(res.detail);
      else setError(res.error);
    });
    return () => {
      alive = false;
    };
  }, [cohortId, teamId, version]);

  const reload = () => setVersion((v) => v + 1);

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, after?: () => void) => {
    setActionError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return setActionError(res.error);
      setComment("");
      after?.();
      reload();
      router.refresh();
    });
  };

  const close = () => {
    onClose();
    setDetail(null);
    setTab("plan");
    setComment("");
    setActionError(null);
  };

  const guide = detail ? stageGuide(detail.project.stage) : null;
  const stageDoneCount = detail && guide ? guide.checkpoints.filter((c) => detail.checks[c.key]?.done).length : 0;

  return (
    <>
      <Sheet open={teamId !== null} onOpenChange={(o) => !o && close()}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{detail ? detail.name : "팀"}</SheetTitle>
            {detail && (
              <SheetDescription render={<div />} className="flex flex-wrap items-center gap-2">
                <StatusBadge domain="teamStage" value={String(detail.project.stage)} />
                <StatusBadge
                  domain="teamPace"
                  value={detail.behind ? "BEHIND" : "ON_TRACK"}
                  label={detail.behind ? `지연 (목표 ${detail.schedule.expected}단계)` : undefined}
                />
                <span className="truncate">{detail.project.title}</span>
              </SheetDescription>
            )}
          </SheetHeader>
          <SheetBody className="space-y-4">
            {error && <Alert tone="danger">{error}</Alert>}
            {!detail && !error && (
              <div className="space-y-2" aria-busy="true">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-8 animate-pulse rounded bg-neutral-100" />
                ))}
              </div>
            )}
            {detail && guide && (
              <>
                <TeamStageSteps stage={detail.project.stage} targets={detail.schedule.targets} expected={detail.schedule.expected} />
                <p className="text-sm text-neutral-600">
                  팀원 {detail.members.length}명 ·{" "}
                  {detail.members.map((m, i) => (
                    <span key={m.userId}>
                      {i > 0 && ", "}
                      {m.name}
                      {m.isLeader && <span className="text-neutral-500">(팀장)</span>}
                    </span>
                  ))}
                </p>
                <nav className="flex gap-1 border-b border-neutral-200" aria-label="팀 상세 보기 전환">
                  {TABS.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setTab(t.key)}
                      aria-current={tab === t.key ? "page" : undefined}
                      className={cn(
                        "-mb-px inline-flex min-h-10 items-center gap-1 border-b-2 px-2.5 text-sm font-medium",
                        tab === t.key ? "border-primary-500 text-primary-700" : "border-transparent text-neutral-500 hover:text-neutral-900"
                      )}
                    >
                      {t.label}
                      {t.key === "log" && <span className="text-xs text-neutral-500 tabular-nums">{detail.logs.length}</span>}
                      {t.key === "feedback" && <span className="text-xs text-neutral-500 tabular-nums">{detail.feedbacks.length}</span>}
                    </button>
                  ))}
                </nav>

                {tab === "plan" && <ProjectPlanView team={detail} />}

                {tab === "check" && (
                  <div className="space-y-4">
                    <section className="space-y-2">
                      <h3 className="text-sm font-semibold text-neutral-900">
                        {guide.stage}단계 {guide.name} 체크포인트{" "}
                        <span className="font-normal text-neutral-500 tabular-nums">
                          {stageDoneCount}/{guide.checkpoints.length}
                        </span>
                      </h3>
                      <p className="text-xs text-neutral-500">
                        목표: {guide.goal} · {guide.period}
                      </p>
                      <CheckList
                        cohortId={cohortId}
                        teamId={detail.id}
                        items={guide.checkpoints}
                        checks={detail.checks}
                        editable={canManage}
                        onChanged={reload}
                      />
                    </section>
                    <section className="space-y-2">
                      <h3 className="text-sm font-semibold text-neutral-900">
                        완료 체크리스트{" "}
                        <span className="font-normal text-neutral-500 tabular-nums">
                          {completionDone(detail.checks)}/{COMPLETION_CHECKLIST.length}
                        </span>
                      </h3>
                      <CheckList
                        cohortId={cohortId}
                        teamId={detail.id}
                        items={COMPLETION_CHECKLIST}
                        checks={detail.checks}
                        editable={canManage}
                        onChanged={reload}
                      />
                    </section>
                  </div>
                )}

                {tab === "log" && <LogList logs={detail.logs} empty="팀원이 쓴 주간 로그가 없습니다." />}

                {tab === "feedback" && (
                  <div className="space-y-4">
                    {canManage && (
                      <section className="space-y-2">
                        <Label htmlFor="team-feedback">피드백 작성 ({detail.project.stage}단계)</Label>
                        <Textarea
                          id="team-feedback"
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          maxLength={2000}
                          className="min-h-24"
                          placeholder="예: 배포 URL은 확인했습니다. README에 실행 방법을 추가해 주세요."
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pending || !comment.trim()}
                          onClick={() => run(() => addFeedbackAction(cohortId, detail.id, comment))}
                        >
                          <MessageSquarePlus /> 피드백 남기기
                        </Button>
                      </section>
                    )}
                    <FeedbackList feedbacks={detail.feedbacks} />
                  </div>
                )}
                {actionError && <Alert tone="danger">{actionError}</Alert>}
              </>
            )}
          </SheetBody>
          {detail && (
            <SheetFooter>
              {!canManage ? (
                <p className="mr-auto text-sm text-neutral-500">열람 전용입니다. 단계 승인과 피드백은 강사가 합니다.</p>
              ) : detail.project.stage >= 4 ? (
                <p className="mr-auto text-sm text-neutral-500">마지막 단계(서류 반영)입니다.</p>
              ) : (
                <>
                  <p className="mr-auto text-xs text-neutral-500 tabular-nums">
                    체크포인트 {stageDoneCount}/{guide?.checkpoints.length}
                  </p>
                  <Button disabled={pending} onClick={() => setConfirmOpen(true)}>
                    <ArrowRightCircle /> 단계 승인
                  </Button>
                </>
              )}
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
      {detail && (
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {detail.project.stage}단계 승인 → {detail.project.stage + 1}단계 {stageGuide(detail.project.stage + 1).name}
              </DialogTitle>
              <DialogDescription>
                {guide && stageDoneCount < guide.checkpoints.length
                  ? `체크포인트 ${guide.checkpoints.length - stageDoneCount}개가 아직 미완료입니다. 그래도 다음 단계로 넘길 수 있습니다.`
                  : "이번 단계 체크포인트를 모두 완료했습니다."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="advance-comment">승인 코멘트 (선택)</Label>
              <Textarea id="advance-comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} className="min-h-20" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={pending}>
                취소
              </Button>
              <Button
                disabled={pending}
                onClick={() =>
                  run(
                    () => advanceStageAction(cohortId, detail.id, comment || null),
                    () => setConfirmOpen(false)
                  )
                }
              >
                {pending ? "처리 중…" : "승인"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
