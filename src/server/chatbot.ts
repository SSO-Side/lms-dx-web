"use server";

// 챗봇(M4) 서버 액션: 질문, 매뉴얼 PDF 등록·삭제. 반 문서는 requireCohortAccess(cohortId는 경로 값만), 학원 공통 문서는 계정의 학원 단위 검사.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireCohortAccess, AccessDeniedError } from "@/lib/access/requireCohortAccess";
import { requireAuthUser } from "@/lib/auth/session";
import { canManageAcademyChatDocsPure } from "@/lib/access/checker";
import { askChatbot, uploadServiceDoc, deleteServiceDoc } from "@/lib/ai/chatbot";
import { toChatRole } from "@/lib/ai/audience";
import { CHAT_QUESTION_MAX, CHAT_DOC_TITLE_MAX, type ChatResponse, type ServiceDoc } from "@/lib/ai/types";
import { checkPdf, saveFile, deleteFile, safeFileName } from "@/lib/storage";
import { getCohortAcademyId, listVisibleChatDocs } from "./chatbot-queries";

const DENIED = { ok: false as const, error: "권한이 없습니다." };

/** 챗봇에 질문한다. sessionId는 대화창마다 클라이언트가 만든 uuid. */
export async function askChatbotAction(cohortId: number, sessionId: string, question: string): Promise<{ ok: true; data: ChatResponse } | { ok: false; error: string }> {
  try {
    const ctx = await requireCohortAccess(cohortId, "chat:ask");
    const academyId = await getCohortAcademyId(ctx.cohortId);
    if (!academyId) return DENIED;
    if (question.trim().length > CHAT_QUESTION_MAX) return { ok: false, error: `질문은 ${CHAT_QUESTION_MAX}자 이내로 입력해 주세요.` };
    const docs = await listVisibleChatDocs(academyId, ctx.cohortId, ctx.role);
    return await askChatbot({ sessionId, question, role: toChatRole(ctx.role), cohortId: ctx.cohortId, academyId }, docs);
  } catch (e) {
    if (e instanceof AccessDeniedError) return DENIED;
    throw e;
  }
}

const uploadSchema = z.object({
  title: z.string().trim().min(1, "문서 제목을 입력해 주세요.").max(CHAT_DOC_TITLE_MAX, `제목은 ${CHAT_DOC_TITLE_MAX}자 이내로 입력해 주세요.`),
  audience: z.enum(["STUDENT", "INSTRUCTOR", "ALL"], { message: "열람 대상을 선택해 주세요." }),
});

type Result = { ok: true } | { ok: false; error: string };
type UploadResult = { ok: true; status: ServiceDoc["status"] } | { ok: false; error: string };

const ACADEMY_DOCS_PATH = "/app/academy/chatbot-docs";

/** 검증 → 파일 저장 → 서비스 전달 → LMS 저장. 권한 확인을 마친 액션에서만 부른다. cohortId가 null이면 학원 공통 문서. */
async function registerDoc(formData: FormData, owner: { academyId: number; cohortId: number | null; userId: number }): Promise<UploadResult> {
  const parsed = uploadSchema.safeParse({ title: formData.get("title"), audience: formData.get("audience") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "PDF 파일을 선택해 주세요." };
  const buf = Buffer.from(await file.arrayBuffer());
  const bad = checkPdf({ name: file.name, type: file.type, size: file.size }, buf.subarray(0, 8));
  if (bad) return { ok: false, error: bad };

  const key = await saveFile("chatbot", buf, "pdf", "application/pdf");
  // 챗봇 서비스에 넘기고, 받아 준 문서만 LMS에 남긴다. 실패하면 저장한 파일도 지운다.
  const sent = await uploadServiceDoc({ file: buf, title: parsed.data.title, audience: parsed.data.audience, cohortId: owner.cohortId, academyId: owner.academyId });
  if (!sent.ok) {
    await deleteFile(key).catch(() => {});
    return sent;
  }
  const status = sent.doc?.status ?? "READY";
  try {
    await db.chatbotDocument.create({
      data: {
        academyId: owner.academyId,
        cohortId: owner.cohortId,
        title: parsed.data.title,
        audience: parsed.data.audience,
        filePath: key,
        fileName: safeFileName(file.name),
        fileSize: file.size,
        uploadedBy: owner.userId,
        serviceDocId: sent.doc?.id ?? null,
        status,
        error: sent.doc?.error?.slice(0, 500) ?? null,
      },
    });
  } catch (e) {
    // LMS에 남기지 못한 문서가 챗봇 검색에 남지 않게 서비스에서도 지운다
    if (sent.doc) await deleteServiceDoc(sent.doc.id).catch(() => {});
    await deleteFile(key).catch(() => {});
    throw e;
  }
  return { ok: true, status };
}

const docSelect = { id: true, filePath: true, serviceDocId: true } as const;

/** 범위 확인을 마친 문서를 지운다. 서비스에서 먼저 지우고, 실패하면 LMS 행을 남겨 목록에 없는 문서가 검색되지 않게 한다. */
async function removeDoc(doc: { id: number; filePath: string; serviceDocId: number | null }): Promise<Result> {
  if (doc.serviceDocId !== null) {
    const removed = await deleteServiceDoc(doc.serviceDocId);
    if (!removed.ok) return removed;
  }
  await db.chatbotDocument.delete({ where: { id: doc.id } });
  await deleteFile(doc.filePath).catch(() => {});
  return { ok: true };
}

/** 이 반의 매뉴얼 PDF 등록 (매니저 이상). */
export async function uploadChatDocAction(cohortId: number, formData: FormData): Promise<UploadResult> {
  try {
    const ctx = await requireCohortAccess(cohortId, "chatDoc:manage");
    const academyId = await getCohortAcademyId(ctx.cohortId);
    if (!academyId) return DENIED;
    const res = await registerDoc(formData, { academyId, cohortId: ctx.cohortId, userId: ctx.user.id });
    if (res.ok) revalidatePath(`/app/c/${ctx.cohortId}/chatbot-docs`);
    return res;
  } catch (e) {
    if (e instanceof AccessDeniedError) return DENIED;
    throw e;
  }
}

/** 이 반의 매뉴얼 삭제. 학원 공통 문서는 여기서 지우지 않는다. */
export async function deleteChatDocAction(cohortId: number, docId: number): Promise<Result> {
  try {
    const ctx = await requireCohortAccess(cohortId, "chatDoc:manage");
    const academyId = await getCohortAcademyId(ctx.cohortId);
    if (!academyId) return DENIED;
    const doc = await db.chatbotDocument.findFirst({ where: { id: docId, academyId, cohortId: ctx.cohortId }, select: docSelect });
    if (!doc) return { ok: false, error: "삭제할 수 없는 문서입니다." };
    const res = await removeDoc(doc);
    if (res.ok) revalidatePath(`/app/c/${ctx.cohortId}/chatbot-docs`);
    return res;
  } catch (e) {
    if (e instanceof AccessDeniedError) return DENIED;
    throw e;
  }
}

/** 학원 공통 매뉴얼 PDF 등록 (학원 관리자). 대상 학원은 로그인 계정의 학원이다. */
export async function uploadAcademyChatDocAction(formData: FormData): Promise<UploadResult> {
  const user = await requireAuthUser();
  if (!canManageAcademyChatDocsPure(user)) return DENIED;
  const res = await registerDoc(formData, { academyId: user.academyId, cohortId: null, userId: user.id });
  if (res.ok) revalidatePath(ACADEMY_DOCS_PATH);
  return res;
}

/** 학원 공통 매뉴얼 삭제 (학원 관리자). 자기 학원의 공통 문서만. */
export async function deleteAcademyChatDocAction(docId: number): Promise<Result> {
  const user = await requireAuthUser();
  if (!canManageAcademyChatDocsPure(user)) return DENIED;
  if (!Number.isInteger(docId)) return { ok: false, error: "삭제할 수 없는 문서입니다." };
  const doc = await db.chatbotDocument.findFirst({ where: { id: docId, academyId: user.academyId, cohortId: null }, select: docSelect });
  if (!doc) return { ok: false, error: "삭제할 수 없는 문서입니다." };
  const res = await removeDoc(doc);
  if (res.ok) revalidatePath(ACADEMY_DOCS_PATH);
  return res;
}
