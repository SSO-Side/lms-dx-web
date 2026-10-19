// 기업 문의 페이지: 이 반 쇼케이스로 들어온 기업 문의 목록(매니저·슈퍼어드민).
import { tryCohortAccess } from "@/lib/access/pageAccess";
import { AccessDenied } from "@/components/shell/AccessDenied";
import { PageHeader } from "@/components/shell/PageHeader";
import { SectionSwitch, careerSections } from "@/components/shell/SectionSwitch";
import { Alert } from "@/components/ui/alert";
import { listLeads, NEW_LEAD_DAYS } from "@/server/lead-queries";
import { LeadBoard } from "./lead-board";

/** 기업 문의 (매니저·슈퍼어드민, lead:read). 이 반 쇼케이스로 들어온 문의만 */
export default async function LeadsPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  const ctx = await tryCohortAccess(cohortId, "lead:read");
  if (!ctx) return <AccessDenied />;
  const leads = await listLeads(ctx.cohortId);
  const fresh = leads.filter((l) => l.isNew).length;

  return (
    <>
      <SectionSwitch items={careerSections(ctx.cohortId, true)} current="leads" />
      <PageHeader
        back={{ href: `/app/c/${ctx.cohortId}`, label: "반 홈" }}
        title="기업 문의"
        description={`마켓플레이스에서 이 반 프로젝트로 들어온 채용 커피챗·도입 문의입니다. 최근 ${NEW_LEAD_DAYS}일 신규 ${fresh}건.`}
      />
      <div className="space-y-4">
        <Alert tone="info">문의자 연락처는 개인정보입니다. 응대 목적 외에 복사·공유하지 마세요. 이메일 알림은 아직 없어 이 화면과 홈 위젯에서 확인합니다.</Alert>
        <LeadBoard rows={leads} />
      </div>
    </>
  );
}
