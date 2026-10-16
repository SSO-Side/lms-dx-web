"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { EnrollmentStatus, type DocumentStatus, type Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireCohortAccess, AccessDeniedError } from "@/lib/access/requireCohortAccess";
import { tryCohortAccess } from "@/lib/access/pageAccess";
import { canTransitionDocument, STATUS_AFTER_NEW_VERSION } from "@/lib/documents/transitions";
import { checkPdf, saveFile, deleteFile } from "@/lib/storage";
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
  NO_VERSION: "파일을 1개 이상 올린 뒤 첨삭을 요청할 수 있습니다.",
  COMMENT_REQUIRED: "수정 요청 사유(코멘트)를 입력해 주세요.",
} as const;

type StoredPdf = { storagePath: string; fileName: string; size: number };

/** 업로드 파일 검증(AI 동의·PDF·10MB) 후 저장. 문자열이면 오류 문구. */
async function storePdf(cohortId: number, formData: FormData): Promise<StoredPdf | string> {
  if (formData.get("aiConsent") !== "on") return "AI 활용 안내에 동의해야 올릴 수 있습니다.";
  const file = formData.get("file");
  if (!file || typeof file !== "object" || file.size === 0) return "PDF 파일을 선택해 주세요.";
  const data = Buffer.from(await file.arrayBuffer());
  const err = checkPdf(file, data);
  if (err) return err;
  const storagePath = await saveFile(`documents/${cohortId}`, data, "pdf");
  return { storagePath, fileName: file.name.slice(0, 255), size: file.size };
}

/** 반 재적 수강생인지 (ADMIN은 호출 측에서 면제) */
async function isEnrolled(cohortId: number, userId: number) {
  const e = await db.enrollment.findUnique({ where: { cohortId_studentId: { cohortId, studentId: userId } }, select: { status: true } });
  return e?.status === EnrollmentStatus.ENROLLED;
}

const createSchema = z.object({
  title: z.string().trim().min(1, "제목을 입력해 주세요.").max(200),
  type: z.enum(["RESUME", "COVER_LETTER", "PORTFOLIO"], { message: "유형을 선택해 주세요." }),
});

/** 서류 추가 (수강생): 서류 + 버전 1, 상태 DRAFT */
export async function createDocumentAction(cohortId: number, formData: FormData): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "resume:own");
    const parsed = createSchema.safeParse({ title: formData.get("title"), type: formData.get("type") });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "입력값 오류" };
    if (ctx.role !== "ADMIN" && !(await isEnrolled(ctx.cohortId, ctx.user.id))) {
      return { ok: false, error: "이 반의 재적 수강생만 올릴 수 있습니다." };
    }

    const stored = await storePdf(ctx.cohortId, formData);
    if (typeof stored === "string") return { ok: false, error: stored };

    try {
      const doc = await db.$transaction(async (tx) => {
        const d = await tx.document.create({
          data: { cohortId: ctx.cohortId, ownerId: ctx.user.id, type: parsed.data.type, title: parsed.data.title, status: "DRAFT" },
        });
        const v = await tx.documentVersion.create({
          data: { documentId: d.id, cohortId: ctx.cohortId, versionNo: 1, ...stored, aiConsentAt: new Date() },
        });
        return tx.document.update({ where: { id: d.id }, data: { currentVersionId: v.id } });
      });
      refresh(ctx.cohortId);
      return { ok: true, documentId: doc.id };
    } catch (e) {
      await deleteFile(stored.storagePath);
      throw e;
    }
  });
}

/** 새 버전 올리기 (수강생 본인): 상태는 DRAFT로 돌아간다 */
export async function uploadVersionAction(cohortId: number, documentId: number, formData: FormData): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "resume:own");
    const doc = await db.document.findFirst({ where: { id: documentId, cohortId: ctx.cohortId }, select: { id: true, ownerId: true } });
    if (!doc || (ctx.role !== "ADMIN" && doc.ownerId !== ctx.user.id)) return { ok: false, error: "서류를 찾을 수 없습니다." };

    const stored = await storePdf(ctx.cohortId, formData);
    if (typeof stored === "string") return { ok: false, error: stored };

    try {
      await db.$transaction(async (tx) => {
        const last = await tx.documentVersion.findFirst({
          where: { documentId: doc.id },
          orderBy: { versionNo: "desc" },
          select: { versionNo: true },
        });
        const v = await tx.documentVersion.create({
          data: { documentId: doc.id, cohortId: ctx.cohortId, versionNo: (last?.versionNo ?? 0) + 1, ...stored, aiConsentAt: new Date() },
        });
        await tx.document.update({ where: { id: doc.id }, data: { currentVersionId: v.id, status: STATUS_AFTER_NEW_VERSION } });
      });
      refresh(ctx.cohortId);
      return { ok: true, documentId: doc.id };
    } catch (e) {
      await deleteFile(stored.storagePath);
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
    select: { id: true, ownerId: true, status: true, _count: { select: { versions: true } } },
  });
  if (!doc) return { ok: false, error: "서류를 찾을 수 없습니다." };
  const check = canTransitionDocument(doc.status, to, ctx.role, {
    isOwner: doc.ownerId === ctx.user.id,
    versionCount: doc._count.versions,
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
