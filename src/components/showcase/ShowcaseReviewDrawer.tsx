"use client";

// 쇼케이스 검토 드로어(교직원): 강사 검토, 매니저 공개 승인·반려·비공개 전환.
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Role, ShowcaseStatus } from "@prisma/client";
import { CheckCircle2, ExternalLink, Globe } from "lucide-react";
import { getShowcaseDetailAction, reviewShowcaseAction, transitionShowcaseAction } from "@/server/showcase";
import type { ShowcaseDetail } from "@/server/showcase-queries";
import { availableShowcaseTransitions, canInstructorReview, canTransitionShowcase, showcaseActor } from "@/lib/showcase/transitions";
import { StatusBadge } from "@/components/StatusBadge";
import { ShowcaseProgress, ShowcasePreview, ConsentList } from "./ShowcaseProgress";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const BLOCK_REASON = {
  NEEDS_CONSENT: "팀원 전원 동의 후 승인할 수 있습니다.",
  NEEDS_REVIEW: "강사 검토 후 승인할 수 있습니다.",
} as const;

/** 교직원 쇼케이스 검토 드로어: 강사(검토 완료·반려), 매니저·슈퍼어드민(공개 승인·반려·비공개 전환). showcaseId가 null이면 닫힘 */
export function ShowcaseReviewDrawer({
  cohortId,
  role,
  showcaseId,
  onClose,
}: {
  cohortId: number;
  role: Role;
  showcaseId: number | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<ShowcaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ to: ShowcaseStatus; label: string; commentRequired: boolean } | null>(null);
  const [comment, setComment] = useState("");
  const [pending, startTransition] = useTransition();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (showcaseId === null) return;
    let alive = true;
    setDetail(null);
    setError(null);
    setActionError(null);
    getShowcaseDetailAction(cohortId, showcaseId).then((res) => {
      if (!alive) return;
      if (res.ok) setDetail(res.detail);
      else setError(res.error);
    });
    return () => {
      alive = false;
    };
  }, [cohortId, showcaseId, version]);

  const actor = showcaseActor(role, false);
  const sc = detail?.showcase ?? null;
  const transitions = sc ? availableShowcaseTransitions(sc.status, actor) : [];
  const canReview = sc ? canInstructorReview(sc.status, actor, !!sc.reviewedAt) : false;

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setActionError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return setActionError(res.error);
      setDialog(null);
      setComment("");
      setVersion((v) => v + 1);
      router.refresh();
    });
  };

  // 공개 승인 버튼이 막힌 이유 (전이표의 조건을 그대로 사용)
  const publishBlock = (() => {
    if (!sc || !detail) return null;
    const check = canTransitionShowcase(sc.status, "PUBLISHED", actor, {
      memberCount: detail.members.length,
      consentCount: sc.consentCount,
      instructorReviewed: !!sc.reviewedAt,
      hasContent: !!sc.problem,
    });
    return check.ok ? null : check.reason === "NEEDS_CONSENT" || check.reason === "NEEDS_REVIEW" ? BLOCK_REASON[check.reason] : null;
  })();

  return (
    <Sheet open={showcaseId !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{detail ? detail.project.title : "쇼케이스"}</SheetTitle>
          {detail && sc && (
            <SheetDescription render={<div />} className="flex flex-wrap items-center gap-2">
              <StatusBadge domain="showcase" value={sc.status} />
              <span>
                {detail.teamName} · 수정 {sc.updatedAt}
              </span>
            </SheetDescription>
          )}
        </SheetHeader>
        <SheetBody className="space-y-5">
          {error && <Alert tone="danger">{error}</Alert>}
          {!detail && !error && (
            <div className="space-y-2" aria-busy="true">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-neutral-100" />
              ))}
            </div>
          )}
          {detail && sc && (
            <>
              <ShowcaseProgress detail={detail} />
              {sc.status === "PUBLISHED" && (
                <Link href={`/market/${sc.slug}`} target="_blank" className="inline-flex min-h-11 items-center gap-1 text-sm text-primary-500 hover:underline">
                  공개 페이지 보기 <ExternalLink className="size-3.5" aria-hidden />
                </Link>
              )}
              {sc.status === "DRAFT" && sc.reviewNote && <Alert tone="warning">최근 반려 사유: {sc.reviewNote}</Alert>}
              <dl className="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-neutral-500">강사 검토</dt>
                <dd className="text-neutral-800">{sc.reviewedAt ? `${sc.reviewedBy} · ${sc.reviewedAt}` : "아직"}</dd>
                <dt className="text-neutral-500">공개 승인</dt>
                <dd className="text-neutral-800">{sc.approvedAt ? `${sc.approvedBy} · ${sc.approvedAt}` : "아직"}</dd>
              </dl>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-neutral-900">
                  팀원 공개 동의 ({sc.consentCount}/{detail.members.length})
                </h3>
                <ConsentList detail={detail} />
                <p className="text-xs text-neutral-500">공개 페이지에는 동의한 팀원의 이름·역할만 표시됩니다.</p>
              </section>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-neutral-900">공개될 내용</h3>
                <ShowcasePreview detail={detail} />
              </section>
              {publishBlock && transitions.some((t) => t.to === "PUBLISHED") && <Alert tone="info">{publishBlock}</Alert>}
              {actionError && !dialog && <Alert tone="danger">{actionError}</Alert>}
            </>
          )}
        </SheetBody>
        {detail && sc && (transitions.length > 0 || canReview) && (
          <SheetFooter className="flex-wrap">
            {transitions.map((t) => (
              <Button
                key={t.to + t.label}
                variant={t.to === "PUBLISHED" ? "default" : "destructive-outline"}
                disabled={pending || (t.to === "PUBLISHED" && !!publishBlock)}
                onClick={() => setDialog({ to: t.to, label: t.label, commentRequired: !!t.commentRequired })}
              >
                {t.to === "PUBLISHED" && <Globe />}
                {t.label}
              </Button>
            ))}
            {canReview && (
              <Button disabled={pending} onClick={() => run(() => reviewShowcaseAction(cohortId, sc.id))}>
                <CheckCircle2 /> {pending ? "처리 중…" : "검토 완료"}
              </Button>
            )}
          </SheetFooter>
        )}
      </SheetContent>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          {dialog && sc && (
            <form className="grid gap-4" action={() => run(() => transitionShowcaseAction(cohortId, sc.id, dialog.to, comment || null))}>
              <DialogHeader>
                <DialogTitle>{dialog.label}</DialogTitle>
                <DialogDescription>
                  {dialog.to === "PUBLISHED" && "로그인 없이 누구나 볼 수 있는 마켓플레이스에 공개됩니다. 학원 이름이 걸린 공개 영역입니다."}
                  {dialog.to === "DRAFT" && "반려하면 초안으로 돌아가고 팀원 동의·검토를 처음부터 다시 받습니다. 사유는 팀원에게 표시됩니다."}
                  {dialog.to === "UNPUBLISHED" && "공개 페이지에서 바로 내려갑니다."}
                </DialogDescription>
              </DialogHeader>
              {dialog.commentRequired && (
                <div className="space-y-1.5">
                  <Label htmlFor="sc-reason">사유 (필수)</Label>
                  <Textarea id="sc-reason" required value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} />
                </div>
              )}
              {actionError && <Alert tone="danger">{actionError}</Alert>}
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialog(null)}>
                  닫기
                </Button>
                <Button type="submit" variant={dialog.to === "PUBLISHED" ? "default" : "destructive"} disabled={pending || (dialog.commentRequired && !comment.trim())}>
                  {pending ? "처리 중…" : dialog.label}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
