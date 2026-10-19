// 기업 문의 조회 함수: 문의 목록, 신규 문의 수.
import type { LeadType } from "@prisma/client";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";

// 호출 측이 먼저 requireCohortAccess(lead:read)로 권한을 확인하고 ctx.cohortId만 넘긴다.

export type LeadRow = {
  id: number;
  type: LeadType;
  company: string;
  contactName: string;
  contact: string;
  message: string;
  projectTitle: string;
  teamName: string;
  createdAt: string;
  isNew: boolean;
};

/** "신규" = 최근 7일 접수 (읽음 표시 컬럼이 없어 기간으로 판단) */
export const NEW_LEAD_DAYS = 7;

/** 이 반 쇼케이스로 들어온 기업 문의 목록(최신순). */
export async function listLeads(cohortId: number, opts: { take?: number; now?: Date } = {}): Promise<LeadRow[]> {
  const since = new Date((opts.now ?? new Date()).getTime() - NEW_LEAD_DAYS * 24 * 60 * 60 * 1000);
  const rows = await db.inboundLead.findMany({
    where: { cohortId },
    include: { showcase: { select: { project: { select: { title: true, team: { select: { name: true } } } } } } },
    orderBy: { createdAt: "desc" },
    take: opts.take,
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    company: r.company,
    contactName: r.contactName,
    contact: r.contact,
    message: r.message,
    projectTitle: r.showcase.project.title,
    teamName: r.showcase.project.team.name,
    createdAt: formatDateTime(r.createdAt),
    isNew: r.createdAt >= since,
  }));
}

/** 최근 7일 신규 문의 수(홈 위젯용). */
export async function countNewLeads(cohortId: number, now: Date = new Date()): Promise<number> {
  const since = new Date(now.getTime() - NEW_LEAD_DAYS * 24 * 60 * 60 * 1000);
  return db.inboundLead.count({ where: { cohortId, createdAt: { gte: since } } });
}
