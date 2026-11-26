// 챗봇 문서 조회 (읽기 전용). 모든 조회는 학원·반 범위로 제한한다: 이 반의 문서 + 이 학원의 공통 문서(cohortId null).
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { visibleAudiences } from "@/lib/ai/audience";

/** 반이 속한 학원 id (없으면 null) */
export async function getCohortAcademyId(cohortId: number): Promise<number | null> {
  const c = await db.cohort.findUnique({ where: { id: cohortId }, select: { academyId: true } });
  return c?.academyId ?? null;
}

/** 질문자가 볼 수 있는 문서 (챗봇 근거 범위): 역할별 대상 + 이 반·학원 공통 */
export async function listVisibleChatDocs(academyId: number, cohortId: number, role: Role) {
  return db.chatbotDocument.findMany({
    where: { academyId, audience: { in: visibleAudiences(role) }, OR: [{ cohortId }, { cohortId: null }] },
    select: { id: true, title: true },
    orderBy: { id: "asc" },
  });
}

/** 관리 화면 목록: 이 반 문서 + 학원 공통 문서 */
export async function listManageChatDocs(academyId: number, cohortId: number) {
  return db.chatbotDocument.findMany({
    where: { academyId, OR: [{ cohortId }, { cohortId: null }] },
    select: { id: true, title: true, audience: true, cohortId: true, fileName: true, fileSize: true, serviceDocId: true, status: true, error: true, createdAt: true, uploader: { select: { name: true } } },
    orderBy: { id: "desc" },
  });
}

/** 파일 전달용: 이 반 문서 또는 학원 공통 문서만 */
export async function getChatDocFile(academyId: number, cohortId: number, id: number) {
  return db.chatbotDocument.findFirst({
    where: { id, academyId, OR: [{ cohortId }, { cohortId: null }] },
    select: { filePath: true, fileName: true, title: true },
  });
}

export type ChatDocRow = Awaited<ReturnType<typeof listManageChatDocs>>[number];
