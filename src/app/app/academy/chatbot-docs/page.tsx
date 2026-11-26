// 학원 문서 페이지: 모든 반의 챗봇이 함께 쓰는 학원 공통 PDF를 등록·삭제한다(학원 관리자).
import { requireAuthUser } from "@/lib/auth/session";
import { canManageAcademyChatDocsPure } from "@/lib/access/checker";
import { PageHeader } from "@/components/shell/PageHeader";
import { Widget } from "@/components/Widget";
import { ChatDocsManager } from "@/components/chatbot/ChatDocsManager";
import { listAcademyChatDocs, toChatDocItem } from "@/server/chatbot-queries";
import { syncChatDocStatus } from "@/server/chatbot-sync";
import { env } from "@/lib/config";

export default async function AcademyChatDocsPage() {
  const user = await requireAuthUser();
  const header = (
    <PageHeader
      back={{ href: "/app/academy", label: "학원 홈" }}
      title="학원 문서"
      description="모든 반의 챗봇이 답변 근거로 쓰는 PDF 문서를 관리합니다."
    />
  );
  if (!canManageAcademyChatDocsPure(user)) {
    return (
      <>
        {header}
        <Widget title="학원 문서" empty={{ message: "학원에 속한 학원 관리자 계정으로 관리할 수 있습니다." }} />
      </>
    );
  }

  await syncChatDocStatus(user.academyId);
  const rows = await listAcademyChatDocs(user.academyId);

  return (
    <>
      {header}
      <ChatDocsManager docs={rows.map((r) => toChatDocItem(r, env.USE_AI_MOCK))} />
    </>
  );
}
