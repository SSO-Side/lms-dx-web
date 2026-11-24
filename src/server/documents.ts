"use server";

// 서류(M7) 서버 액션: 서류 저장(입력 양식), 첨삭 요청, 강사 코멘트·상태 변경.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { EnrollmentStatus, Prisma, type DocumentStatus, type Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireCohortAccess, AccessDeniedError } from "@/lib/access/requireCohortAccess";
import { tryCohortAccess } from "@/lib/access/pageAccess";
import { canTransitionDocument, STATUS_AFTER_EDIT } from "@/lib/documents/transitions";
import { isFormDocumentType, parseDocumentContent } from "@/lib/documents/forms";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents/labels";
import { getDocumentDetail, type DocumentDetail } from "./document-queries";

type Result = { ok: true; documentId?: number } | { ok: false; error: string };

async function wrap(fn: () => Promise<Result>): Promise<Result> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AccessDeniedError) return { ok: false, error: "권한이 없습니다." };
    throw e;
  }
}

function refresh(cohortId: number) {
  revalidatePath(`/app/c/${cohortId}/resume`);
  revalidatePath(`/app/c/${cohortId}`);
}

const TRANSITION_ERRORS = {
  NOT_ALLOWED: "현재 상태에서 할 수 없는 처리입니다.",
  NOT_OWNER: "본인 서류만 처리할 수 있습니다.",
  NO_CONTENT: "내용을 저장한 뒤 첨삭을 요청할 수 있습니다.",
  COMMENT_REQUIRED: "수정 요청 사유(코멘트)를 입력해 주세요.",
} as const;

/** 반 재적 수강생인지 (ADMIN은 호출 측에서 면제) */
async function isEnrolled(cohortId: number, userId: number) {
  const e = await db.enrollment.findUnique({ where: { cohortId_studentId: { cohortId, studentId: userId } }, select: { status: true } });
  return e?.status === EnrollmentStatus.ENROLLED;
}

/**
 * 서류 저장 (수강생): 이력서·자기소개서는 반마다 유형당 1개. 없으면 만들고 있으면 내용을 고친다.
 * 내용을 고치면 상태는 DRAFT로 돌아간다. `type`·`content`는 서버에서 다시 검증한다.
 */
export async function saveDocumentAction(cohortId: number, type: string, content: unknown): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "resume:own");
    if (!isFormDocumentType(type)) return { ok: false, error: "저장할 수 없는 서류 유형입니다." };
    const parsed = parseDocumentContent(type, content);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    if (ctx.role !== "ADMIN" && !(await isEnrolled(ctx.cohortId, ctx.user.id))) {
      return { ok: false, error: "이 반의 재적 수강생만 저장할 수 있습니다." };
    }

    const key = { cohortId: ctx.cohortId, ownerId: ctx.user.id, type };
    const json = parsed.content as Prisma.InputJsonValue;
    try {
      const existing = await db.document.findFirst({ where: key, select: { id: true } });
      if (existing) {
        await db.document.updateMany({ where: { id: existing.id, ...key }, data: { content: json, status: STATUS_AFTER_EDIT } });
        refresh(ctx.cohortId);
        return { ok: true, documentId: existing.id };
      }
      const doc = await db.document.create({ data: { ...key, title: DOCUMENT_TYPE_LABELS[type], content: json, status: "DRAFT" } });
      refresh(ctx.cohortId);
      return { ok: true, documentId: doc.id };
    } catch (e) {
      // 동시에 두 번 저장해 유니크(반·소유자·유형) 충돌이 난 경우
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return { ok: false, error: "이미 저장된 서류가 있습니다. 새로고침 후 다시 시도해 주세요." };
      }
      throw e;
    }
  });
}

/** 상태 전이 공통: 전이표 검사 → 낙관적 갱신 → 코멘트 기록 */
async function applyTransition(
  ctx: { cohortId: number; role: Role; user: { id: number } },
  documentId: number,
  to: DocumentStatus,
  comment: string | null
): Promise<Result> {
  const doc = await db.document.findFirst({
    where: { id: documentId, cohortId: ctx.cohortId },
    select: { id: true, ownerId: true, status: true, content: true },
  });
  if (!doc) return { ok: false, error: "서류를 찾을 수 없습니다." };
  const check = canTransitionDocument(doc.status, to, ctx.role, {
    isOwner: doc.ownerId === ctx.user.id,
    hasContent: doc.content !== null,
    comment,
  });
  if (!check.ok) return { ok: false, error: TRANSITION_ERRORS[check.reason] };

  const done = await db.$transaction(async (tx) => {
    const updated = await tx.document.updateMany({ where: { id: doc.id, status: doc.status }, data: { status: to } });
    if (updated.count !== 1) return false;
    if (comment?.trim()) {
      await tx.documentReviewNote.create({
        data: { documentId: doc.id, cohortId: ctx.cohortId, reviewerId: ctx.user.id, comment: comment.trim() },
      });
    }
    return true;
  });
  if (!done) return { ok: false, error: "다른 사람이 먼저 처리했습니다. 새로고침해 주세요." };
  refresh(ctx.cohortId);
  return { ok: true, documentId: doc.id };
}

/** 첨삭 요청 (수강생 본인, DRAFT → IN_REVIEW, 버전 1개 이상) */
export async function requestReviewAction(cohortId: number, documentId: number): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "resume:own");
    return applyTransition(ctx, documentId, "IN_REVIEW", null);
  });
}

const commentSchema = z.string().trim().max(2000, "코멘트는 2000자 이내로 입력해 주세요.");

/** 강사 처리: 완성(DONE) / 수정 요청(DRAFT, 코멘트 필수) */
export async function reviewDocumentAction(
  cohortId: number,
  documentId: number,
  to: "DONE" | "DRAFT",
  comment: string | null
): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "resume:review");
    const parsed = commentSchema.safeParse(comment ?? "");
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "입력값 오류" };
    return applyTransition(ctx, documentId, to, parsed.data || null);
  });
}

/** 강사 코멘트만 남기기 (상태 변경 없음) */
export async function addReviewNoteAction(cohortId: number, documentId: number, comment: string): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "resume:review");
    const parsed = commentSchema.min(1, "코멘트를 입력해 주세요.").safeParse(comment);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "입력값 오류" };
    const doc = await db.document.findFirst({ where: { id: documentId, cohortId: ctx.cohortId }, select: { id: true } });
    if (!doc) return { ok: false, error: "서류를 찾을 수 없습니다." };
    await db.documentReviewNote.create({ data: { documentId: doc.id, cohortId: ctx.cohortId, reviewerId: ctx.user.id, comment: parsed.data } });
    refresh(ctx.cohortId);
    return { ok: true, documentId: doc.id };
  });
}

/** 강사 드로어용 상세 (버전·코멘트) */
export async function getDocumentDetailAction(
  cohortId: number,
  documentId: number
): Promise<{ ok: true; detail: DocumentDetail } | { ok: false; error: string }> {
  const ctx = await tryCohortAccess(cohortId, "resume:review");
  if (!ctx) return { ok: false, error: "권한이 없습니다." };
  const detail = await getDocumentDetail(ctx.cohortId, documentId);
  if (!detail) return { ok: false, error: "서류를 찾을 수 없습니다." };
  return { ok: true, detail };
}
