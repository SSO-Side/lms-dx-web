"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { NotebookPen, PencilLine } from "lucide-react";
import type { TeamDetail } from "@/server/team-queries";
import { saveProjectLogAction, saveProjectPlanAction } from "@/server/team";
import { COMPLETION_CHECKLIST, completionDone, progressPercent, stageDone, stageGuide, weekOfYmd } from "@/lib/team/guide";
import { StatusBadge } from "@/components/StatusBadge";
import { TeamStageSteps } from "@/components/team/TeamStageSteps";
import { CheckList } from "@/components/team/CheckList";
import { FeedbackList, LogList, ProjectPlanView } from "@/components/team/TeamHistory";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter } from "@/components/ui/sheet";

function Section({ title, action, children }: { title: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold text-neutral-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** 수강생 "내 팀": 단계 스테퍼, 이번 단계 체크포인트, 강사 피드백, 주간 로그, 기획안, 완료 체크리스트 */
export function StudentTeam({ cohortId, team, userId, today }: { cohortId: number; team: TeamDetail; userId: number; today: string }) {
  const [planOpen, setPlanOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const p = team.project;
  const guide = stageGuide(p.stage);
  const done = completionDone(team.checks);
  const percent = progressPercent(done, COMPLETION_CHECKLIST.length);
  const thisWeek = weekOfYmd(today);
  const myLog = team.logs.find((l) => l.userId === userId && l.weekOf === thisWeek) ?? null;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-neutral-200 bg-card p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm text-neutral-500">{team.name}</p>
            <h2 className="text-lg font-semibold text-neutral-900">{p.title}</h2>
          </div>
          <StatusBadge domain="teamStage" value={String(p.stage)} />
        </div>
        <p className="mt-1 text-sm text-neutral-600">
          {team.members.map((m, i) => (
            <span key={m.userId}>
              {i > 0 && " · "}
              {m.name}
              {m.isLeader && <span className="text-neutral-500">(팀장)</span>}
            </span>
          ))}
        </p>
        <TeamStageSteps className="mt-4" stage={p.stage} targets={team.schedule.targets} expected={team.schedule.expected} />
        {team.behind && (
          <Alert tone="warning" className="mt-3">
            반 일정 기준 목표는 {team.schedule.expected}단계입니다. 체크포인트를 채우고 강사에게 단계 점검을 요청하세요.
          </Alert>
        )}
      </section>

      <Section
        title={
          <>
            이번 단계 체크포인트{" "}
            <span className="text-sm font-normal text-neutral-500 tabular-nums">
              {stageDone(p.stage, team.checks)}/{guide.checkpoints.length}
            </span>
          </>
        }
      >
        <p className="mb-2 text-sm text-neutral-600">
          {guide.stage}. {guide.name} — {guide.goal} (목표일 {team.schedule.targets[guide.stage]})
        </p>
        <CheckList cohortId={cohortId} teamId={team.id} items={guide.checkpoints} checks={team.checks} editable comfortable />
        <p className="mt-2 text-xs text-neutral-500">모두 채우면 강사가 확인 후 다음 단계로 승인합니다.</p>
      </Section>

      <Section title="강사 피드백">
        <FeedbackList feedbacks={team.feedbacks} empty="아직 강사 피드백이 없습니다. 단계 점검 때 남겨집니다." />
      </Section>

      <Section
        title="주간 로그"
        action={
          <Button size="sm" onClick={() => setLogOpen(true)}>
            <NotebookPen /> {myLog ? "이번 주 로그 수정" : "이번 주 로그 쓰기"}
          </Button>
        }
      >
        <p className="mb-2 text-sm text-neutral-600">진행 / 막힌 점 / 해결 / 수치를 매주 남기면 이력서 소재가 됩니다.</p>
        <LogList logs={team.logs} empty="아직 팀원이 쓴 로그가 없습니다." />
      </Section>

      <Section
        title="기획안"
        action={
          <Button size="sm" variant="outline" onClick={() => setPlanOpen(true)}>
            <PencilLine /> 편집
          </Button>
        }
      >
        <ProjectPlanView team={team} />
      </Section>

      <Section
        title={
          <>
            완료 체크리스트{" "}
            <span className="text-sm font-normal text-neutral-500 tabular-nums">
              {done}/{COMPLETION_CHECKLIST.length}
            </span>
          </>
        }
      >
        <div
          className="mb-3 h-2 overflow-hidden rounded-full bg-neutral-100"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="완료 체크리스트 진행률"
        >
          <div className="h-full rounded-full bg-primary-500" style={{ width: `${percent}%` }} />
        </div>
        <CheckList cohortId={cohortId} teamId={team.id} items={COMPLETION_CHECKLIST} checks={team.checks} editable comfortable />
      </Section>

      <PlanSheet cohortId={cohortId} team={team} open={planOpen} onClose={() => setPlanOpen(false)} />
      <LogSheet cohortId={cohortId} teamId={team.id} open={logOpen} today={today} initial={myLog} onClose={() => setLogOpen(false)} />
    </div>
  );
}

/** 기획안·링크 편집: 소개, 문제 정의, 핵심 기능(3개 이내), 기술 스택, 역할 분담, 저장소·배포 URL */
function PlanSheet({ cohortId, team, open, onClose }: { cohortId: number; team: TeamDetail; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const p = team.project;
  const initRoles = () => team.members.map((m) => ({ name: m.name, part: p.plan.roles.find((r) => r.name === m.name)?.part ?? "" }));
  const [title, setTitle] = useState(p.title);
  const [summary, setSummary] = useState(p.summary ?? "");
  const [problem, setProblem] = useState(p.plan.problem);
  const [features, setFeatures] = useState<string[]>([0, 1, 2].map((i) => p.plan.features[i] ?? ""));
  const [stack, setStack] = useState(p.techStack.join(", "));
  const [roles, setRoles] = useState(initRoles);
  const [repoUrl, setRepoUrl] = useState(p.repoUrl ?? "");
  const [deployUrl, setDeployUrl] = useState(p.deployUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setTitle(p.title);
    setSummary(p.summary ?? "");
    setProblem(p.plan.problem);
    setFeatures([0, 1, 2].map((i) => p.plan.features[i] ?? ""));
    setStack(p.techStack.join(", "));
    setRoles(initRoles());
    setRepoUrl(p.repoUrl ?? "");
    setDeployUrl(p.deployUrl ?? "");
    setError(null);
  };

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await saveProjectPlanAction(cohortId, team.id, {
        title,
        summary,
        problem,
        features: features.map((f) => f.trim()).filter(Boolean),
        techStack: stack
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        roles,
        repoUrl,
        deployUrl,
      });
      if (!res.ok) return setError(res.error);
      router.refresh();
      onClose();
    });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (o) reset();
        else onClose();
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>기획안 편집</SheetTitle>
          <SheetDescription>팀원 누구나 고칠 수 있습니다. 마지막 저장 내용이 반영됩니다.</SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-4">
          <Field id="plan-title" label="프로젝트 이름">
            <Input id="plan-title" className="h-12 text-base" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </Field>
          <Field id="plan-summary" label="프로젝트 소개">
            <Textarea
              id="plan-summary"
              className="min-h-24 text-base"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={2000}
              placeholder="무엇을·왜 만드는지 한 문단으로"
            />
          </Field>
          <Field id="plan-problem" label="문제 정의 (1문장)">
            <Input
              id="plan-problem"
              className="h-12 text-base"
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              maxLength={300}
              placeholder="예: 자취생은 남은 재료로 만들 메뉴를 고르기 어렵다"
            />
          </Field>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-neutral-900">핵심 기능 (3개 이내)</legend>
            {features.map((f, i) => (
              <Input
                key={i}
                aria-label={`핵심 기능 ${i + 1}`}
                className="h-12 text-base"
                value={f}
                maxLength={100}
                placeholder={`기능 ${i + 1}`}
                onChange={(e) => setFeatures((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
              />
            ))}
          </fieldset>
          <Field id="plan-stack" label="기술 스택 (쉼표로 구분)">
            <Input
              id="plan-stack"
              className="h-12 text-base"
              value={stack}
              onChange={(e) => setStack(e.target.value)}
              placeholder="예: Next.js, Spring Boot, MySQL"
            />
          </Field>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-neutral-900">역할 분담</legend>
            {roles.map((r, i) => (
              <div key={r.name} className="grid grid-cols-[5rem_1fr] items-center gap-2">
                <span className="truncate text-sm text-neutral-700">{r.name}</span>
                <Input
                  aria-label={`${r.name} 역할`}
                  className="h-11 text-base"
                  value={r.part}
                  maxLength={200}
                  placeholder="예: 백엔드 API, 배포"
                  onChange={(e) => setRoles((arr) => arr.map((x, j) => (j === i ? { ...x, part: e.target.value } : x)))}
                />
              </div>
            ))}
          </fieldset>
          <Field id="plan-repo" label="저장소 URL">
            <Input
              id="plan-repo"
              type="url"
              inputMode="url"
              className="h-12 text-base"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/..."
            />
          </Field>
          <Field id="plan-deploy" label="배포 URL">
            <Input
              id="plan-deploy"
              type="url"
              inputMode="url"
              className="h-12 text-base"
              value={deployUrl}
              onChange={(e) => setDeployUrl(e.target.value)}
              placeholder="https://..."
            />
          </Field>
          {error && <Alert tone="danger">{error}</Alert>}
        </SheetBody>
        <SheetFooter>
          <Button size="lg" variant="outline" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button size="lg" onClick={submit} disabled={pending}>
            {pending ? "저장하는 중…" : "저장"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** 개인 주간 로그: 진행(필수) / 막힌 점 / 해결 / 수치. 같은 주에 다시 쓰면 수정 */
function LogSheet({
  cohortId,
  teamId,
  open,
  today,
  initial,
  onClose,
}: {
  cohortId: number;
  teamId: number;
  open: boolean;
  today: string;
  initial: TeamDetail["logs"][number] | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState("");
  const [blocker, setBlocker] = useState("");
  const [resolution, setResolution] = useState("");
  const [metric, setMetric] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setProgress(initial?.progress ?? "");
    setBlocker(initial?.blocker ?? "");
    setResolution(initial?.resolution ?? "");
    setMetric(initial?.metric ?? "");
    setError(null);
  };

  const submit = () => {
    setError(null);
    if (!progress.trim()) return setError("이번 주 진행 내용을 입력해 주세요.");
    startTransition(async () => {
      const res = await saveProjectLogAction(cohortId, teamId, { date: today, progress, blocker, resolution, metric });
      if (!res.ok) return setError(res.error);
      router.refresh();
      onClose();
    });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (o) reset();
        else onClose();
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{initial ? "이번 주 로그 수정" : "이번 주 로그 쓰기"}</SheetTitle>
          <SheetDescription>{weekOfYmd(today)} 주 · 개인 기록입니다.</SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-4">
          <Field id="log-progress" label="진행 (필수)">
            <Textarea
              id="log-progress"
              className="min-h-24 text-base"
              value={progress}
              onChange={(e) => setProgress(e.target.value)}
              maxLength={2000}
              placeholder="이번 주에 직접 구현한 것"
            />
          </Field>
          <Field id="log-blocker" label="막힌 점">
            <Textarea id="log-blocker" className="min-h-20 text-base" value={blocker} onChange={(e) => setBlocker(e.target.value)} maxLength={2000} />
          </Field>
          <Field id="log-resolution" label="해결">
            <Textarea
              id="log-resolution"
              className="min-h-20 text-base"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              maxLength={2000}
              placeholder="원인 → 해결 → 결과"
            />
          </Field>
          <Field id="log-metric" label="수치">
            <Input
              id="log-metric"
              className="h-12 text-base"
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              maxLength={200}
              placeholder="예: 목록 API 응답 1.2초 → 0.3초"
            />
          </Field>
          {error && <Alert tone="danger">{error}</Alert>}
        </SheetBody>
        <SheetFooter>
          <Button size="lg" variant="outline" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button size="lg" onClick={submit} disabled={pending}>
            {pending ? "저장하는 중…" : "저장"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
