"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ShowcaseStatus } from "@prisma/client";
import { Download, ExternalLink, ImageUp, Plus, Save, Send, Trash2, UserCheck, UserX } from "lucide-react";
import type { ShowcaseDetail } from "@/server/showcase-queries";
import { saveShowcaseDraftAction, uploadShowcaseImageAction, transitionShowcaseAction, setShowcaseConsentAction } from "@/server/showcase";
import { availableShowcaseTransitions, canEditShowcase, canChangeConsent } from "@/lib/showcase/transitions";
import { StatusBadge } from "@/components/StatusBadge";
import { ShowcaseProgress, ShowcasePreview, ConsentList } from "@/components/showcase/ShowcaseProgress";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const CONSENT_TEXT = "공개 페이지(로그인 없이 누구나 볼 수 있음)에 내 이름과 팀 역할이 표시되는 데 동의합니다. 연락처·이메일은 표시되지 않습니다.";

// 확인 모달이 필요한 전이와 안내 문구
const CONFIRM: Partial<Record<ShowcaseStatus, string>> = {
  IN_REVIEW: "공개 신청 뒤에는 내용을 고칠 수 없습니다. 팀원 전원 동의 → 강사 검토 → 학원 승인 순서로 진행됩니다.",
  UNPUBLISHED: "공개 페이지에서 바로 내려갑니다. 다시 공개하려면 편집 후 처음부터 신청해야 합니다.",
};

type Result = { ok: true } | { ok: false; error: string };

/** 수강생 쇼케이스 탭: 공개 절차 진행, 초안 편집(초안일 때만), 내 동의, 신청·취소·비공개 전환 */
export function StudentShowcase({ cohortId, detail, userId }: { cohortId: number; detail: ShowcaseDetail; userId: number }) {
  const router = useRouter();
  const sc = detail.showcase;
  const status: ShowcaseStatus = sc?.status ?? "DRAFT";
  const editable = canEditShowcase(status, "MEMBER");
  const me = detail.members.find((m) => m.userId === userId);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ to: ShowcaseStatus; label: string } | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<Result>, after?: () => void) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return setError(res.error);
      after?.();
      router.refresh();
    });
  };

  const actions = sc ? availableShowcaseTransitions(status, "MEMBER") : [];

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-xl border border-neutral-200 bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-neutral-500">{detail.teamName}</p>
            <h2 className="truncate font-semibold text-neutral-900">{detail.project.title}</h2>
          </div>
          <StatusBadge domain="showcase" value={sc ? status : "NONE"} />
        </div>
        <ShowcaseProgress detail={detail} />
        {status === "PUBLISHED" && sc && (
          <Link href={`/market/${sc.slug}`} target="_blank" className="inline-flex min-h-11 items-center gap-1 text-sm text-primary-500 hover:underline">
            공개 페이지 보기 <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        )}
        {status === "DRAFT" && sc?.reviewNote && <Alert tone="warning">반려 사유: {sc.reviewNote}</Alert>}
        {status === "UNPUBLISHED" && <Alert tone="info">비공개 상태입니다. [다시 편집]을 누르면 초안으로 돌아가 내용을 고친 뒤 다시 신청할 수 있습니다.</Alert>}
        <p className="text-xs text-neutral-500">기본값은 비공개입니다. 팀원 전원 동의, 강사 검토, 학원 승인이 모두 끝나야 마켓플레이스에 공개됩니다.</p>
      </section>

      {editable ? (
        <DraftEditor key={sc?.updatedAt ?? "new"} cohortId={cohortId} detail={detail} />
      ) : (
        <section className="rounded-xl border border-neutral-200 bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-neutral-900">신청한 내용</h3>
          <ShowcasePreview detail={detail} />
        </section>
      )}

      {sc && (status === "IN_REVIEW" || status === "PUBLISHED") && (
        <section className="space-y-3 rounded-xl border border-neutral-200 bg-card p-4">
          <h3 className="text-sm font-semibold text-neutral-900">
            팀원 공개 동의 ({sc.consentCount}/{detail.members.length})
          </h3>
          <ConsentList detail={detail} />
          {me && canChangeConsent(status, "MEMBER") && (
            <div className="space-y-2 rounded-lg bg-neutral-50 p-3">
              <p className="text-sm text-neutral-700">{CONSENT_TEXT}</p>
              {me.consentedAt ? (
                <Button variant="destructive-outline" size="lg" className="w-full sm:w-auto" disabled={pending} onClick={() => (status === "PUBLISHED" ? setWithdrawOpen(true) : run(() => setShowcaseConsentAction(cohortId, sc.id, false)))}>
                  <UserX /> 동의 철회
                </Button>
              ) : (
                <Button size="lg" className="w-full sm:w-auto" disabled={pending} onClick={() => run(() => setShowcaseConsentAction(cohortId, sc.id, true))}>
                  <UserCheck /> 공개에 동의합니다
                </Button>
              )}
            </div>
          )}
        </section>
      )}

      {error && <Alert tone="danger">{error}</Alert>}

      {sc && actions.length > 0 && (
        <div className="flex flex-wrap justify-end gap-2">
          {actions.map((a) => (
            <Button
              key={a.to + a.label}
              size="lg"
              variant={a.to === "IN_REVIEW" ? "default" : a.to === "UNPUBLISHED" ? "destructive-outline" : "outline"}
              disabled={pending}
              onClick={() => (CONFIRM[a.to] ? setConfirm({ to: a.to, label: a.label }) : run(() => transitionShowcaseAction(cohortId, sc.id, a.to, null)))}
            >
              {a.to === "IN_REVIEW" && <Send />}
              {a.label}
            </Button>
          ))}
        </div>
      )}

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          {confirm && sc && (
            <>
              <DialogHeader>
                <DialogTitle>{confirm.label}</DialogTitle>
                <DialogDescription>{CONFIRM[confirm.to]}</DialogDescription>
              </DialogHeader>
              {error && <Alert tone="danger">{error}</Alert>}
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirm(null)}>
                  닫기
                </Button>
                <Button
                  variant={confirm.to === "UNPUBLISHED" ? "destructive" : "default"}
                  disabled={pending}
                  onClick={() => run(() => transitionShowcaseAction(cohortId, sc.id, confirm.to, null), () => setConfirm(null))}
                >
                  {pending ? "처리 중…" : confirm.label}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>동의 철회</DialogTitle>
            <DialogDescription>공개 중에 동의를 철회하면 팀원 전원 동의 조건이 깨져 프로젝트가 즉시 비공개로 전환됩니다.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawOpen(false)}>
              닫기
            </Button>
            <Button variant="destructive" disabled={pending} onClick={() => sc && run(() => setShowcaseConsentAction(cohortId, sc.id, false), () => setWithdrawOpen(false))}>
              철회하고 비공개 전환
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** 초안 편집: 프로젝트에서 불러오기, 문제 정의, 정량 성과, URL, 이미지 */
function DraftEditor({ cohortId, detail }: { cohortId: number; detail: ShowcaseDetail }) {
  const router = useRouter();
  const sc = detail.showcase;
  const [problem, setProblem] = useState(sc?.problem ?? "");
  const [metrics, setMetrics] = useState(sc?.metrics.length ? sc.metrics : [{ label: "", value: "" }]);
  const [demoUrl, setDemoUrl] = useState(sc?.demoUrl ?? "");
  const [repoUrl, setRepoUrl] = useState(sc?.repoUrl ?? "");
  const [message, setMessage] = useState<{ tone: "danger" | "success"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const importFromProject = () => {
    if (!problem.trim()) setProblem(detail.project.problem || detail.project.summary || "");
    if (!demoUrl) setDemoUrl(detail.project.deployUrl ?? "");
    if (!repoUrl) setRepoUrl(detail.project.repoUrl ?? "");
    setMessage({ tone: "success", text: "팀 프로젝트의 문제 정의·배포·저장소 주소를 채웠습니다. 확인 후 저장하세요." });
  };

  const save = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await saveShowcaseDraftAction(cohortId, detail.teamId, { problem, metrics, demoUrl, repoUrl });
      if (!res.ok) return setMessage({ tone: "danger", text: res.error });
      setMessage({ tone: "success", text: "저장했습니다." });
      router.refresh();
    });
  };

  const upload = (kind: "cover" | "architecture", file: File | undefined) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setMessage({ tone: "danger", text: "이미지는 5MB 이하만 올릴 수 있습니다." });
    const fd = new FormData();
    fd.set("file", file);
    setMessage(null);
    startTransition(async () => {
      const res = await uploadShowcaseImageAction(cohortId, detail.teamId, kind, fd);
      if (!res.ok) return setMessage({ tone: "danger", text: res.error });
      setMessage({ tone: "success", text: "이미지를 올렸습니다." });
      router.refresh();
    });
  };

  return (
    <section className="space-y-4 rounded-xl border border-neutral-200 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-900">쇼케이스 초안</h3>
        <Button variant="outline" size="sm" onClick={importFromProject} disabled={pending}>
          <Download /> 팀 프로젝트에서 불러오기
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sc-problem">문제 정의</Label>
        <Textarea id="sc-problem" value={problem} onChange={(e) => setProblem(e.target.value)} maxLength={2000} className="min-h-28 text-base" placeholder="누가, 어떤 상황에서, 무엇 때문에 불편한가" />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-caption font-medium text-neutral-700">정량 성과 (최대 6개)</legend>
        {metrics.map((m, i) => (
          <div key={i} className="flex gap-2">
            <Input aria-label={`성과 ${i + 1} 항목`} className="h-11 flex-1 text-base" placeholder="예: 목록 API 응답" value={m.label} maxLength={40} onChange={(e) => setMetrics(metrics.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <Input aria-label={`성과 ${i + 1} 값`} className="h-11 flex-1 text-base" placeholder="예: 2.1초 → 0.4초" value={m.value} maxLength={60} onChange={(e) => setMetrics(metrics.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
            <Button variant="ghost" size="icon" className="size-11 shrink-0" aria-label={`성과 ${i + 1} 삭제`} onClick={() => setMetrics(metrics.filter((_, j) => j !== i))}>
              <Trash2 />
            </Button>
          </div>
        ))}
        {metrics.length < 6 && (
          <Button variant="link" size="sm" onClick={() => setMetrics([...metrics, { label: "", value: "" }])}>
            <Plus /> 항목 추가
          </Button>
        )}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sc-demo">시연 URL</Label>
          <Input id="sc-demo" type="url" className="h-11 text-base" value={demoUrl} onChange={(e) => setDemoUrl(e.target.value)} placeholder="https://" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sc-repo">저장소 URL</Label>
          <Input id="sc-repo" type="url" className="h-11 text-base" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            { kind: "cover", label: "대표 이미지", url: sc?.coverUrl },
            { kind: "architecture", label: "아키텍처 이미지", url: sc?.architectureUrl },
          ] as const
        ).map((img) => (
          <div key={img.kind} className="space-y-1.5">
            <p className="text-caption font-medium text-neutral-700">{img.label}</p>
            <div className="overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
              {img.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- 권한 확인 후 서버가 전달하는 비공개 이미지
                <img src={img.url} alt={img.label} className="aspect-video w-full object-cover" />
              ) : (
                <div className="flex aspect-video items-center justify-center text-xs text-neutral-400">아직 없음</div>
              )}
            </div>
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md bg-primary-50 px-3 text-sm font-medium text-primary-700 hover:bg-primary-100">
              <ImageUp className="size-4" aria-hidden /> {img.url ? "바꾸기" : "올리기"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={pending} onChange={(e) => upload(img.kind, e.target.files?.[0])} />
            </label>
          </div>
        ))}
      </div>
      <p className="text-xs text-neutral-500">PNG·JPG·WEBP, 5MB 이하. 개인정보(얼굴, 연락처)가 담긴 이미지는 올리지 마세요.</p>

      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <div className="flex justify-end">
        <Button size="lg" onClick={save} disabled={pending}>
          <Save /> {pending ? "저장하는 중…" : "초안 저장"}
        </Button>
      </div>
    </section>
  );
}
