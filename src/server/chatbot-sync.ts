// 처리 중인 챗봇 문서의 상태를 서비스에서 가져와 갱신한다. 서버 액션이 아니다: 권한 확인을 마친 서버 코드에서만 부른다.
import { db } from "@/lib/db";
import { listServiceDocs } from "@/lib/ai/chatbot";

/**
 * 학원 공통 문서 중 PROCESSING이 있을 때만 서비스 목록을 조회한다.
 * LMS가 올린 문서(serviceDocId가 일치)만 갱신하고, 서비스에만 있는 문서(챗봇 폴더 문서 등)는 가져오지 않는다.
 * 서비스에 연결하지 못하면 아무것도 바꾸지 않는다.
 */
export async function syncChatDocStatus(academyId: number): Promise<void> {
  const waiting = await db.chatbotDocument.findMany({
    where: { academyId, cohortId: null, status: "PROCESSING", serviceDocId: { not: null } },
    select: { id: true, serviceDocId: true },
  });
  if (waiting.length === 0) return;

  const remote = await listServiceDocs(academyId);
  if (!remote) return;
  const byId = new Map(remote.map((d) => [d.id, d]));

  for (const row of waiting) {
    const doc = byId.get(row.serviceDocId!);
    if (!doc || doc.status === "PROCESSING") continue;
    await db.chatbotDocument.updateMany({
      where: { id: row.id, academyId, status: "PROCESSING" },
      data: { status: doc.status, error: doc.error?.slice(0, 500) ?? null },
    });
  }
}
