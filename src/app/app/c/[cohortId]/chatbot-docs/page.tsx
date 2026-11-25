// 챗봇 매뉴얼 관리 페이지: 매니저·학원 관리자가 챗봇 응답 근거 PDF를 등록·삭제한다 (chatDoc:manage).
import { tryCohortAccess } from "@/lib/access/pageAccess";
import { AccessDenied } from "@/components/shell/AccessDenied";
import { PageHeader } from "@/components/shell/PageHeader";
import { getCohortAcademyId, listManageChatDocs } from "@/server/chatbot-queries";
import { ChatbotDocsClient, type ChatDocItem } from "./chatbot-docs-client";

export default async function ChatbotDocsPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  const ctx = await tryCohortAccess(cohortId, "chatDoc:manage");
  if (!ctx) return <AccessDenied />;
  const academyId = await getCohortAcademyId(ctx.cohortId);
  if (!academyId) return <AccessDenied />;

  const isAdmin = ctx.role === "ACADEMY_ADMIN" || ctx.role === "ADMIN";
  const rows = await listManageChatDocs(academyId, ctx.cohortId);
  const docs: ChatDocItem[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    audience: r.audience,
    isAcademyWide: r.cohortId === null,
    fileName: r.fileName,
    sizeLabel: `${(r.fileSize / 1024 / 1024).toFixed(1)}MB`,
    dateLabel: r.createdAt.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }),
    uploaderName: r.uploader.name,
    canDelete: r.cohortId !== null || isAdmin,
  }));

  return (
    <>
      <PageHeader title="챗봇 매뉴얼" description="챗봇이 답변 근거로 쓰는 PDF 문서를 관리합니다. 학원 전체 문서는 학원 관리자만 등록·삭제할 수 있습니다." />
      <ChatbotDocsClient cohortId={ctx.cohortId} docs={docs} canAcademyWide={isAdmin} />
    </>
  );
}
