"use server";

// 챗봇(M4) 서버 액션: 질문, 매뉴얼 PDF 등록·삭제. 첫 줄에서 requireCohortAccess, cohortId는 경로 값만 쓴다.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireCohortAccess, AccessDeniedError } from "@/lib/access/requireCohortAccess";
import { askChatbot } from "@/lib/ai/chatbot";
import { toChatRole } from "@/lib/ai/audience";
import { CHAT_QUESTION_MAX, type ChatResponse } from "@/lib/ai/types";
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
  title: z.string().trim().min(1, "문서 제목을 입력해 주세요.").max(200, "제목은 200자 이내로 입력해 주세요."),
  audience: z.enum(["STUDENT", "INSTRUCTOR", "ALL"], { message: "열람 대상을 선택해 주세요." }),
  scope: z.enum(["COHORT", "ACADEMY"], { message: "적용 범위를 선택해 주세요." }),
});

type Result = { ok: true } | { ok: false; error: string };

/** 매뉴얼 PDF 등록. 반 문서는 매니저 이상, 학원 공통 문서는 학원 관리자만. */
export async function uploadChatDocAction(cohortId: number, formData: FormData): Promise<Result> {
  try {
    const ctx = await requireCohortAccess(cohortId, "chatDoc:manage");
    const parsed = uploadSchema.safeParse({ title: formData.get("title"), audience: formData.get("audience"), scope: formData.get("scope") });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    if (parsed.data.scope === "ACADEMY" && ctx.role !== "ACADEMY_ADMIN" && ctx.role !== "ADMIN") {
      return { ok: false, error: "학원 공통 문서는 학원 관리자만 등록할 수 있습니다." };
    }
    const academyId = await getCohortAcademyId(ctx.cohortId);
    if (!academyId) return DENIED;

    const file = formData.get("file");
    if (!(file instanceof File)) return { ok: false, error: "PDF 파일을 선택해 주세요." };
    const buf = Buffer.from(await file.arrayBuffer());
    const bad = checkPdf({ name: file.name, type: file.type, size: file.size }, buf.subarray(0, 8));
    if (bad) return { ok: false, error: bad };

    const key = await saveFile("chatbot", buf, "pdf", "application/pdf");
    try {
      await db.chatbotDocument.create({
        data: {
          academyId,
          cohortId: parsed.data.scope === "COHORT" ? ctx.cohortId : null,
          title: parsed.data.title,
          audience: parsed.data.audience,
          filePath: key,
          fileName: safeFileName(file.name),
          fileSize: file.size,
          uploadedBy: ctx.user.id,
        },
      });
    } catch (e) {
      await deleteFile(key).catch(() => {});
      throw e;
    }
    revalidatePath(`/app/c/${ctx.cohortId}/chatbot-docs`);
    return { ok: true };
  } catch (e) {
    if (e instanceof AccessDeniedError) return DENIED;
    throw e;
  }
}

/** 매뉴얼 삭제. 매니저는 이 반 문서만, 학원 관리자는 학원 공통도 가능. 학원·반 조건을 where에 포함한다. */
export async function deleteChatDocAction(cohortId: number, docId: number): Promise<Result> {
  try {
    const ctx = await requireCohortAccess(cohortId, "chatDoc:manage");
    const academyId = await getCohortAcademyId(ctx.cohortId);
    if (!academyId) return DENIED;
    const isAdmin = ctx.role === "ACADEMY_ADMIN" || ctx.role === "ADMIN";
    const doc = await db.chatbotDocument.findFirst({
      where: { id: docId, academyId, OR: isAdmin ? [{ cohortId: ctx.cohortId }, { cohortId: null }] : [{ cohortId: ctx.cohortId }] },
      select: { id: true, filePath: true },
    });
    if (!doc) return { ok: false, error: "삭제할 수 없는 문서입니다." };
    await db.chatbotDocument.delete({ where: { id: doc.id } });
    await deleteFile(doc.filePath).catch(() => {});
    revalidatePath(`/app/c/${ctx.cohortId}/chatbot-docs`);
    return { ok: true };
  } catch (e) {
    if (e instanceof AccessDeniedError) return DENIED;
    throw e;
  }
}
