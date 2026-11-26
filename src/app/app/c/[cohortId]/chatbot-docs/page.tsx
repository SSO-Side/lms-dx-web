// 챗봇 매뉴얼 관리 페이지: 매니저·학원 관리자가 이 반의 챗봇 근거 PDF를 등록·삭제하고, 학원 문서는 읽기 전용으로 본다 (chatDoc:manage).
import Link from "next/link";
import { tryCohortAccess } from "@/lib/access/pageAccess";
import { AccessDenied } from "@/components/shell/AccessDenied";
import { PageHeader } from "@/components/shell/PageHeader";
import { SectionSwitch, manageSections } from "@/components/shell/SectionSwitch";
import { buttonVariants } from "@/components/ui/button";
import { ChatDocsManager, SharedChatDocs } from "@/components/chatbot/ChatDocsManager";
import { getCohortAcademyId, listManageChatDocs, toChatDocItem } from "@/server/chatbot-queries";
import { syncChatDocStatus } from "@/server/chatbot-sync";
import { env } from "@/lib/config";

export default async function ChatbotDocsPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  const ctx = await tryCohortAccess(cohortId, "chatDoc:manage");
  if (!ctx) return <AccessDenied />;
  const academyId = await getCohortAcademyId(ctx.cohortId);
  if (!academyId) return <AccessDenied />;

  const isAdmin = ctx.role === "ACADEMY_ADMIN" || ctx.role === "ADMIN";
  await syncChatDocStatus(academyId, ctx.cohortId);
  const rows = await listManageChatDocs(academyId, ctx.cohortId);
  const items = (academyWide: boolean) =>
    rows.filter((r) => (r.cohortId === null) === academyWide).map((r) => toChatDocItem(r, env.USE_AI_MOCK));

  return (
    <>
      <SectionSwitch items={manageSections(ctx.cohortId)} current="chatbot-docs" />
      <PageHeader
        back={{ href: `/app/c/${ctx.cohortId}`, label: "반 홈" }}
        title="챗봇 매뉴얼"
        description="이 반 챗봇만 답변 근거로 쓰는 PDF를 관리합니다. 모든 반이 함께 쓰는 문서는 아래 학원 문서에서 볼 수 있습니다."
      />
      <div className="space-y-4">
        <ChatDocsManager cohortId={ctx.cohortId} docs={items(false)} />
        <SharedChatDocs
          cohortId={ctx.cohortId}
          docs={items(true)}
          manageLink={
            isAdmin ? (
              <Link href="/app/academy/chatbot-docs" className={buttonVariants({ variant: "outline", size: "xs" })}>
                학원 문서 관리
              </Link>
            ) : undefined
          }
        />
      </div>
    </>
  );
}
