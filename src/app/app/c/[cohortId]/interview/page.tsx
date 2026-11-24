// 면접 페이지(수강생): 마이페이지(내 서류)에 저장한 이력서·자기소개서를 불러와 보여 준다.
// 질문 생성 등 외부 면접 서비스 연동은 규격 확정 후(후속). 입력 출처는 getInterviewDocuments 하나.
import Link from "next/link";
import { Role } from "@prisma/client";
import { requireAuthUser } from "@/lib/auth/session";
import { tryCohortAccess } from "@/lib/access/pageAccess";
import { AccessDenied } from "@/components/shell/AccessDenied";
import { PageHeader } from "@/components/shell/PageHeader";
import { DocumentContentView } from "@/components/documents/DocumentHistory";
import { StatusBadge } from "@/components/StatusBadge";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { AI_CONSENT_TEXT } from "@/lib/documents/labels";
import { getInterviewDocuments } from "@/server/document-queries";

export default async function InterviewPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  const user = await requireAuthUser();
  if (user.role !== Role.STUDENT) return <AccessDenied />;
  const ctx = await tryCohortAccess(cohortId, "resume:own");
  if (!ctx) return <AccessDenied />;

  const docs = await getInterviewDocuments(ctx.cohortId, ctx.user.id);
  const resumeHref = `/app/c/${ctx.cohortId}/resume`;
  const items = [
    { key: "resume", title: "이력서", type: "RESUME" as const, doc: docs.resume },
    { key: "cover", title: "자기소개서", type: "COVER_LETTER" as const, doc: docs.coverLetter },
  ];

  return (
    <div className="mx-auto max-w-3xl lg:mx-0 lg:max-w-4xl">
      <PageHeader back={{ href: `/app/c/${ctx.cohortId}`, label: "반 홈" }} title="면접" description="내 서류에 저장한 이력서와 자기소개서를 불러왔습니다. 면접 준비에 활용합니다." />
      <div className="space-y-4">
        <Alert tone="info">{AI_CONSENT_TEXT}</Alert>
        {items.map(({ key, title, type, doc }) => (
          <section key={key} className="space-y-2 rounded-xl border border-neutral-200 bg-card p-4">
            <div className="flex items-center gap-2">
              <h2 className="min-w-0 flex-1 font-semibold text-neutral-900">{title}</h2>
              {doc && <StatusBadge domain="document" value={doc.status} />}
            </div>
            {doc ? (
              <>
                <p className="text-xs text-neutral-500 tabular-nums">최근 수정 {doc.updatedAt}</p>
                <DocumentContentView type={type} content={doc.content} />
              </>
            ) : (
              <div className="space-y-2 py-4 text-center">
                <p className="text-sm text-neutral-500">저장된 {title}가 없습니다. 내 서류에서 먼저 작성해 주세요.</p>
                <Link href={resumeHref} className={buttonVariants({ size: "sm" })}>
                  내 서류로 이동
                </Link>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
