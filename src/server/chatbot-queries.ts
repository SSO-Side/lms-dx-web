// 챗봇 문서 조회 (읽기 전용). 문서는 학원 공통(cohortId null)만 쓰며, 모든 조회는 학원 범위로 제한한다.
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { visibleAudiences } from "@/lib/ai/audience";

/** 반이 속한 학원 id (없으면 null) */
export async function getCohortAcademyId(cohortId: number): Promise<number | null> {
  const c = await db.cohort.findUnique({ where: { id: cohortId }, select: { academyId: true } });
  return c?.academyId ?? null;
}

/** 질문자가 볼 수 있는 문서 (챗봇 근거 범위): 역할별 대상 + 학원 공통 */
export async function listVisibleChatDocs(academyId: number, role: Role) {
  return db.chatbotDocument.findMany({
    where: { academyId, cohortId: null, audience: { in: visibleAudiences(role) } },
    select: { id: true, title: true },
    orderBy: { id: "asc" },
  });
}

const manageSelect = {
  id: true, title: true, audience: true, fileName: true, fileSize: true,
  serviceDocId: true, status: true, error: true, createdAt: true, uploader: { select: { name: true } },
} as const;

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

export type ChatDocRow = Awaited<ReturnType<typeof listAcademyChatDocs>>[number];

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
