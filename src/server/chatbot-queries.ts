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

const manageSelect = {
  id: true, title: true, audience: true, cohortId: true, fileName: true, fileSize: true,
  serviceDocId: true, status: true, error: true, createdAt: true, uploader: { select: { name: true } },
} as const;

/** 반 관리 화면 목록: 이 반 문서 + 학원 공통 문서(읽기 전용으로 따로 보여 준다) */
export async function listManageChatDocs(academyId: number, cohortId: number) {
  return db.chatbotDocument.findMany({
    where: { academyId, OR: [{ cohortId }, { cohortId: null }] },
    select: manageSelect,
    orderBy: { id: "desc" },
  });
}

/** 학원 문서 화면 목록: 학원 공통 문서만 */
export async function listAcademyChatDocs(academyId: number) {
  return db.chatbotDocument.findMany({ where: { academyId, cohortId: null }, select: manageSelect, orderBy: { id: "desc" } });
}

/** 파일 전달용: 학원 공통 문서만 */
export async function getAcademyChatDocFile(academyId: number, id: number) {
  return db.chatbotDocument.findFirst({
    where: { id, academyId, cohortId: null },
    select: { filePath: true, fileName: true },
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

export type ChatDocItem = {
  id: number;
  title: string;
  audience: ChatDocRow["audience"];
  fileName: string;
  sizeLabel: string;
  dateLabel: string;
  uploaderName: string;
  status: ChatDocRow["status"] | "UNSYNCED";
  error: string | null;
};

/** 조회 행 → 화면 표시용. mock이 아닌데 서비스 문서 id가 없으면 "챗봇 미반영" */
export function toChatDocItem(r: ChatDocRow, mock: boolean): ChatDocItem {
  return {
    id: r.id,
    title: r.title,
    audience: r.audience,
    fileName: r.fileName,
    sizeLabel: `${(r.fileSize / 1024 / 1024).toFixed(1)}MB`,
    dateLabel: r.createdAt.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }),
    uploaderName: r.uploader.name,
    status: !mock && r.serviceDocId === null ? "UNSYNCED" : r.status,
    error: r.error,
  };
}
