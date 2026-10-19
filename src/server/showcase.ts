"use server";

// 쇼케이스(M10) 서버 액션: 작성·이미지 업로드, 공개 신청·동의, 강사 검토, 공개 승인·반려.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role, type ShowcaseStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireCohortAccess, AccessDeniedError, type CohortContext } from "@/lib/access/requireCohortAccess";
import { tryCohortAccess } from "@/lib/access/pageAccess";
import type { Action } from "@/lib/access/permissions";
import { canViewShowcaseInternalPure } from "@/lib/access/checker";
import {
  canTransitionShowcase,
  canInstructorReview,
  canChangeConsent,
  canEditShowcase,
  showcaseActor,
  STATUS_AFTER_CONSENT_WITHDRAWN,
} from "@/lib/showcase/transitions";
import { generateSlug, isImageKind } from "@/lib/showcase/public";
import { checkImage, saveFile, deleteFile } from "@/lib/storage";
import { getTeamAccessInfo } from "./team-queries";
import { getShowcaseAccessInfo, getTeamShowcase, type ShowcaseDetail } from "./showcase-queries";

type Result = { ok: true } | { ok: false; error: string };

async function wrap(fn: () => Promise<Result>): Promise<Result> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AccessDeniedError) return { ok: false, error: "권한이 없습니다." };
    throw e;
  }
}

function refresh(cohortId: number) {
  revalidatePath(`/app/c/${cohortId}/team`);
  revalidatePath(`/app/c/${cohortId}`);
  revalidatePath("/market");
}

const NOT_FOUND = "쇼케이스를 찾을 수 없습니다.";

/** 역할별 쇼케이스 권한 키: 신청(수강생) / 검토(강사) / 승인(매니저·슈퍼어드민) */
function showcaseKey(role: Role): Action {
  if (role === Role.STUDENT) return "showcase:apply";
  if (role === Role.INSTRUCTOR) return "showcase:review";
  return "showcase:approve"; // MANAGER, ACADEMY_ADMIN, ADMIN
}

/** 반 접근 확인 후 역할에 맞는 쇼케이스 키로 다시 확인 (team:feedback은 모든 역할이 가진 열람 키) */
async function requireShowcaseAccess(cohortId: number): Promise<CohortContext> {
  const base = await requireCohortAccess(cohortId, "team:feedback");
  return requireCohortAccess(base.cohortId, showcaseKey(base.role));
}

// http(s)만 허용 (javascript: 등 차단)
const urlField = z
  .string()
  .trim()
  .max(500, "URL은 500자 이내로 입력해 주세요.")
  .refine((v) => v === "" || /^https?:\/\/[^\s]+$/i.test(v), "http:// 또는 https:// 로 시작하는 주소를 입력해 주세요.")
  .transform((v) => v || null);

const draftSchema = z.object({
  problem: z.string().trim().max(2000, "문제 정의는 2000자 이내로 입력해 주세요."),
  metrics: z
    .array(z.object({ label: z.string().trim().max(40), value: z.string().trim().max(60) }))
    .max(6, "성과 항목은 6개까지 입력할 수 있습니다.")
    .transform((ms) => ms.filter((m) => m.label && m.value)),
  demoUrl: urlField,
  repoUrl: urlField,
});

/** 본인 팀(수강생)인지 확인하고 쇼케이스를 가져오거나 초안으로 만든다 */
async function ownTeamShowcase(ctx: CohortContext, teamId: number) {
  const team = await getTeamAccessInfo(ctx.cohortId, teamId);
  if (!team) return null;
  const isMember = team.memberIds.includes(ctx.user.id);
  const actor = showcaseActor(ctx.role, isMember);
  if (actor !== "MEMBER" && actor !== "ADMIN") return null;
  const existing = await db.showcase.findUnique({ where: { projectId: team.projectId } });
  const showcase =
    existing ??
    (await db.showcase.create({ data: { projectId: team.projectId, cohortId: ctx.cohortId, slug: generateSlug(), metrics: [], status: "DRAFT" } }));
  if (showcase.cohortId !== ctx.cohortId) return null;
  return { team, actor, showcase };
}

/** 초안 저장 (팀원, 초안 상태에서만) */
export async function saveShowcaseDraftAction(cohortId: number, teamId: number, input: z.input<typeof draftSchema>): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "showcase:apply");
    const parsed = draftSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "입력값 오류" };
    const own = await ownTeamShowcase(ctx, teamId);
    if (!own) return { ok: false, error: NOT_FOUND };
    if (!canEditShowcase(own.showcase.status, own.actor)) return { ok: false, error: "초안 상태에서만 수정할 수 있습니다. 비공개 전환 뒤 [다시 편집]을 눌러 주세요." };
    await db.showcase.update({ where: { id: own.showcase.id }, data: parsed.data });
    refresh(ctx.cohortId);
    return { ok: true };
  });
}

/** 대표·아키텍처 이미지 업로드 (팀원, 초안 상태에서만). png·jpg·webp 시그니처, 5MB */
export async function uploadShowcaseImageAction(cohortId: number, teamId: number, kind: string, formData: FormData): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "showcase:apply");
    if (!isImageKind(kind)) return { ok: false, error: "이미지 종류가 올바르지 않습니다." };
    const own = await ownTeamShowcase(ctx, teamId);
    if (!own) return { ok: false, error: NOT_FOUND };
    if (!canEditShowcase(own.showcase.status, own.actor)) return { ok: false, error: "초안 상태에서만 이미지를 바꿀 수 있습니다." };

    const file = formData.get("file");
    if (!file || typeof file !== "object" || file.size === 0) return { ok: false, error: "이미지를 선택해 주세요." };
    const data = Buffer.from(await file.arrayBuffer());
    const checked = checkImage(file, data);
    if (typeof checked === "string") return { ok: false, error: checked };

    const path = await saveFile(`showcases/${ctx.cohortId}`, data, checked.ext);
    const field = kind === "cover" ? "coverImagePath" : "architectureImagePath";
    const old = own.showcase[field];
    try {
      await db.showcase.update({ where: { id: own.showcase.id }, data: { [field]: path } });
    } catch (e) {
      await deleteFile(path);
      throw e;
    }
    if (old && !old.startsWith("seed/")) await deleteFile(old);
    refresh(ctx.cohortId);
    return { ok: true };
  });
}

const TRANSITION_ERRORS = {
  NOT_ALLOWED: "현재 상태에서 할 수 없는 처리입니다.",
  COMMENT_REQUIRED: "반려 사유를 입력해 주세요.",
  NEEDS_CONSENT: "팀원 전원이 동의해야 공개할 수 있습니다.",
  NEEDS_REVIEW: "강사 검토가 끝나야 공개할 수 있습니다.",
  NEEDS_CONTENT: "문제 정의를 작성하고 저장한 뒤 신청해 주세요.",
} as const;

const resetReview = { instructorReviewedBy: null, instructorReviewedAt: null, approvedBy: null, approvedAt: null } as const;

/** 상태 전이 (전이표 기준). 신청·다시 편집은 동의·검토를 처음부터 다시 받는다. */
export async function transitionShowcaseAction(cohortId: number, showcaseId: number, to: ShowcaseStatus, comment: string | null): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireShowcaseAccess(cohortId);
    const sc = await getShowcaseAccessInfo(ctx.cohortId, showcaseId);
    if (!sc) return { ok: false, error: NOT_FOUND };
    const actor = showcaseActor(ctx.role, sc.memberIds.includes(ctx.user.id));
    if (actor === "NONE") return { ok: false, error: NOT_FOUND };
    const note = comment?.trim().slice(0, 2000) || null;
    const check = canTransitionShowcase(sc.status, to, actor, {
      memberCount: sc.memberIds.length,
      consentCount: sc.consentCount,
      instructorReviewed: sc.instructorReviewed,
      hasContent: sc.hasContent,
      comment: note,
    });
    if (!check.ok) return { ok: false, error: TRANSITION_ERRORS[check.reason] };

    const now = new Date();
    const data =
      to === "IN_REVIEW"
        ? { status: to, reviewNote: null, ...resetReview }
        : to === "DRAFT" && sc.status === "IN_REVIEW"
          ? { status: to, reviewNote: check.rule.commentRequired ? note : null, ...resetReview }
          : to === "DRAFT"
            ? { status: to, reviewNote: null, ...resetReview, publishedAt: null }
            : to === "PUBLISHED"
              ? { status: to, approvedBy: ctx.user.id, approvedAt: now, publishedAt: now }
              : { status: to };

    const done = await db.$transaction(async (tx) => {
      const updated = await tx.showcase.updateMany({ where: { id: sc.id, status: sc.status }, data });
      if (updated.count !== 1) return false;
      // 신청·다시 편집: 이전 동의는 무효 (내용이 바뀔 수 있으므로 전원에게 다시 받는다)
      if (to === "IN_REVIEW" || (to === "DRAFT" && sc.status === "UNPUBLISHED")) {
        await tx.showcaseConsent.deleteMany({ where: { showcaseId: sc.id } });
      }
      return true;
    });
    if (!done) return { ok: false, error: "다른 사람이 먼저 처리했습니다. 새로고침해 주세요." };
    refresh(ctx.cohortId);
    return { ok: true };
  });
}

/** 강사 검토 완료 (상태 변경 없음, 공개 승인의 전제 조건) */
export async function reviewShowcaseAction(cohortId: number, showcaseId: number): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "showcase:review");
    const sc = await getShowcaseAccessInfo(ctx.cohortId, showcaseId);
    if (!sc) return { ok: false, error: NOT_FOUND };
    const actor = showcaseActor(ctx.role, sc.memberIds.includes(ctx.user.id));
    if (!canInstructorReview(sc.status, actor, sc.instructorReviewed)) return { ok: false, error: TRANSITION_ERRORS.NOT_ALLOWED };
    const updated = await db.showcase.updateMany({
      where: { id: sc.id, status: "IN_REVIEW", instructorReviewedAt: null },
      data: { instructorReviewedBy: ctx.user.id, instructorReviewedAt: new Date() },
    });
    if (updated.count !== 1) return { ok: false, error: "다른 사람이 먼저 처리했습니다. 새로고침해 주세요." };
    refresh(ctx.cohortId);
    return { ok: true };
  });
}

/** 팀원 본인의 공개 동의·철회. 공개 중 철회하면 자동으로 비공개 전환 */
export async function setShowcaseConsentAction(cohortId: number, showcaseId: number, agree: boolean): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "showcase:apply");
    const sc = await getShowcaseAccessInfo(ctx.cohortId, showcaseId);
    if (!sc || !sc.memberIds.includes(ctx.user.id)) return { ok: false, error: NOT_FOUND };
    const actor = showcaseActor(ctx.role, true);
    if (!canChangeConsent(sc.status, actor)) return { ok: false, error: "공개 신청 중이거나 공개 중일 때만 동의·철회할 수 있습니다." };

    if (agree) {
      await db.showcaseConsent.upsert({
        where: { showcaseId_userId: { showcaseId: sc.id, userId: ctx.user.id } },
        create: { showcaseId: sc.id, userId: ctx.user.id },
        update: {},
      });
    } else {
      await db.$transaction(async (tx) => {
        await tx.showcaseConsent.deleteMany({ where: { showcaseId: sc.id, userId: ctx.user.id } });
        if (sc.status === "PUBLISHED") {
          await tx.showcase.updateMany({ where: { id: sc.id, status: "PUBLISHED" }, data: { status: STATUS_AFTER_CONSENT_WITHDRAWN } });
        }
      });
    }
    refresh(ctx.cohortId);
    return { ok: true };
  });
}

/** 교직원 드로어용 상세. 같은 반 강사·매니저·슈퍼어드민 */
export async function getShowcaseDetailAction(
  cohortId: number,
  showcaseId: number
): Promise<{ ok: true; detail: ShowcaseDetail } | { ok: false; error: string }> {
  const base = await tryCohortAccess(cohortId, "team:feedback");
  if (!base || base.role === Role.STUDENT) return { ok: false, error: "권한이 없습니다." };
  const ctx = await tryCohortAccess(cohortId, showcaseKey(base.role));
  if (!ctx) return { ok: false, error: "권한이 없습니다." };
  const sc = await getShowcaseAccessInfo(ctx.cohortId, showcaseId);
  if (!sc || !canViewShowcaseInternalPure({ id: ctx.user.id, role: ctx.role }, ctx.cohortId, sc)) return { ok: false, error: NOT_FOUND };
  const detail = await getTeamShowcase(ctx.cohortId, { showcaseId });
  if (!detail) return { ok: false, error: NOT_FOUND };
  return { ok: true, detail };
}
