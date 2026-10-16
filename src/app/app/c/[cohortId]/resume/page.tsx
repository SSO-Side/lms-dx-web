import Link from "next/link";
import { Role, type DocumentStatus } from "@prisma/client";
import { requireAuthUser } from "@/lib/auth/session";
import { tryCohortAccess } from "@/lib/access/pageAccess";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import { DOCUMENT_STATUSES, DOCUMENT_STATUS_LABELS } from "@/lib/documents/labels";
import { AccessDenied } from "@/components/shell/AccessDenied";
import { PageHeader } from "@/components/shell/PageHeader";
import { Alert } from "@/components/ui/alert";
import {
  listMyDocuments,
  listCohortDocuments,
  countDocumentsByStatus,
  getCohortDocumentStatus,
  getAcademyDocumentStatus,
} from "@/server/document-queries";
import { StudentDocuments } from "./student-documents";
import { WritingGuide } from "./guide";
import { ReviewBoard } from "./review-board";
import { StageSummary, StudentStatusTable, CohortStageTable } from "./status-board";

interface Props {
  params: Promise<{ cohortId: string }>;
  searchParams: Promise<{ tab?: string; status?: string }>;
}

function Tabs({ items, current }: { items: Array<{ key: string; label: string; href: string; count?: number }>; current: string }) {
  return (
    <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-neutral-200" aria-label="보기 전환">
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={current === t.key ? "page" : undefined}
          className={cn(
            "-mb-px inline-flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-medium",
            current === t.key ? "border-primary-500 text-primary-700" : "border-transparent text-neutral-500 hover:text-neutral-900"
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="rounded-full bg-neutral-100 px-1.5 text-xs text-neutral-600 tabular-nums">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

export default async function ResumePage({ params, searchParams }: Props) {
  const { cohortId } = await params;
  const sp = await searchParams;
  const user = await requireAuthUser();

  // 수강생: 내 서류 + 작성 가이드
  if (user.role === Role.STUDENT) {
    const ctx = await tryCohortAccess(cohortId, "resume:own");
    if (!ctx) return <AccessDenied />;
    const base = `/app/c/${ctx.cohortId}/resume`;
    const tab = sp.tab === "guide" ? "guide" : "mine";
    const documents = tab === "mine" ? await listMyDocuments(ctx.cohortId, ctx.user.id) : [];
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader back={{ href: `/app/c/${ctx.cohortId}`, label: "반 홈" }} title="내 서류" description="이력서·자기소개서·포트폴리오를 PDF로 올리고 강사 첨삭을 받습니다." />
        <Tabs
          current={tab}
          items={[
            { key: "mine", label: "내 서류", href: base },
            { key: "guide", label: "작성 가이드", href: `${base}?tab=guide` },
          ]}
        />
        {tab === "mine" ? <StudentDocuments cohortId={ctx.cohortId} documents={documents} /> : <WritingGuide />}
      </div>
    );
  }

  // 강사(·개발팀): 같은 반 수강생 서류 첨삭
  if (user.role === Role.INSTRUCTOR || user.role === Role.ADMIN) {
    const ctx = await tryCohortAccess(cohortId, "resume:review");
    if (!ctx) return <AccessDenied />;
    const base = `/app/c/${ctx.cohortId}/resume`;
    const status = DOCUMENT_STATUSES.find((s) => s === sp.status) ?? (sp.status === "ALL" ? null : "IN_REVIEW");
    const [rows, counts] = await Promise.all([listCohortDocuments(ctx.cohortId, status ?? undefined), countDocumentsByStatus(ctx.cohortId)]);
    const total = counts.DRAFT + counts.IN_REVIEW + counts.DONE;
    return (
      <>
        <PageHeader
          back={{ href: `/app/c/${ctx.cohortId}`, label: "반 홈" }}
          title="서류 첨삭"
          description="같은 반 수강생의 서류입니다. 행을 누르면 PDF 열람, 코멘트, 상태 변경을 할 수 있습니다."
        />
        <Tabs
          current={status ?? "ALL"}
          items={[
            ...(["IN_REVIEW", "DRAFT", "DONE"] as DocumentStatus[]).map((s) => ({
              key: s,
              label: DOCUMENT_STATUS_LABELS[s],
              href: `${base}?status=${s}`,
              count: counts[s],
            })),
            { key: "ALL", label: "전체", href: `${base}?status=ALL`, count: total },
          ]}
        />
        <ReviewBoard
          cohortId={ctx.cohortId}
          rows={rows}
          emptyMessage={status === "IN_REVIEW" ? "첨삭을 요청한 서류가 없습니다." : "해당하는 서류가 없습니다."}
        />
      </>
    );
  }

  // 매니저·슈퍼어드민: 상태 현황만 (파일 열람 불가)
  const ctx = await tryCohortAccess(cohortId, "resume:readOthers");
  if (!ctx) return <AccessDenied />;
  const [{ rows, stages }, cohort] = await Promise.all([
    getCohortDocumentStatus(ctx.cohortId),
    db.cohort.findUnique({ where: { id: ctx.cohortId }, select: { academyId: true } }),
  ]);
  const academyRows = ctx.role === Role.ACADEMY_ADMIN && cohort ? await getAcademyDocumentStatus(cohort.academyId) : null;

  return (
    <>
      <PageHeader
        back={{ href: `/app/c/${ctx.cohortId}`, label: "반 홈" }}
        title="서류 현황"
        description="수강생별 이력서·자기소개서·포트폴리오 진행 상태입니다. 진행 단계는 가장 덜 진행된 서류 기준입니다."
      />
      <div className="space-y-5">
        <StageSummary stages={stages} total={rows.length} />
        <Alert tone="info">파일 내용은 본인과 담당 강사만 열람합니다. 이 화면에서는 상태만 확인할 수 있습니다.</Alert>
        {academyRows && (
          <section className="space-y-2">
            <h2 className="font-semibold text-neutral-900">반별 현황</h2>
            <CohortStageTable rows={academyRows} currentCohortId={ctx.cohortId} />
          </section>
        )}
        <section className="space-y-2">
          <h2 className="font-semibold text-neutral-900">수강생별 현황</h2>
          <StudentStatusTable rows={rows} />
        </section>
      </div>
    </>
  );
}
