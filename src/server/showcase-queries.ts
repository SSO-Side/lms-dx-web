import type { ShowcaseStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { parseMetrics, parseStack, toPublicShowcase, type ImageKind, type Metric, type PublicShowcase } from "@/lib/showcase/public";
import { allConsented } from "@/lib/showcase/transitions";
import { parsePlan } from "./team-queries";

// LMS 조회: 호출 측이 먼저 requireCohortAccess로 권한을 확인하고 ctx.cohortId만 넘긴다.
// 공개 조회(listPublicShowcases·getPublicShowcase·getPublicImagePath): 반 권한의 예외. PUBLISHED + 화이트리스트 필드만 select 한다.

export function internalImageHref(cohortId: number, showcaseId: number, kind: ImageKind, version: string) {
  // version: 이미지 교체 후 브라우저 캐시를 피하려는 값 (updatedAt)
  return `/api/c/${cohortId}/showcases/${showcaseId}/images/${kind}?v=${encodeURIComponent(version)}`;
}

export type ShowcaseMember = { userId: number; name: string; role: string | null; isLeader: boolean; consentedAt: string | null };

export type ShowcaseDetail = {
  teamId: number;
  teamName: string;
  project: { title: string; summary: string | null; problem: string; techStack: string[]; repoUrl: string | null; deployUrl: string | null };
  members: ShowcaseMember[];
  showcase: null | {
    id: number;
    slug: string;
    status: ShowcaseStatus;
    problem: string;
    metrics: Metric[];
    demoUrl: string | null;
    repoUrl: string | null;
    coverUrl: string | null;
    architectureUrl: string | null;
    reviewNote: string | null;
    reviewedBy: string | null;
    reviewedAt: string | null;
    approvedBy: string | null;
    approvedAt: string | null;
    publishedAt: string | null;
    consentCount: number;
    allConsented: boolean;
    updatedAt: string;
  };
};

/** 팀의 쇼케이스 상세 (팀 화면 쇼케이스 탭·교직원 드로어). 쇼케이스가 아직 없으면 showcase=null */
export async function getTeamShowcase(cohortId: number, where: { teamId?: number; showcaseId?: number }): Promise<ShowcaseDetail | null> {
  const team = await db.team.findFirst({
    where: { cohortId, ...(where.teamId ? { id: where.teamId } : {}), ...(where.showcaseId ? { project: { showcase: { id: where.showcaseId } } } : {}) },
    select: {
      id: true,
      name: true,
      leaderId: true,
      members: { select: { userId: true, role: true, user: { select: { name: true } } }, orderBy: { joinedAt: "asc" } },
      project: {
        select: {
          title: true,
          summary: true,
          plan: true,
          techStack: true,
          repoUrl: true,
          deployUrl: true,
          showcase: {
            include: {
              consents: { select: { userId: true, consentedAt: true } },
              reviewer: { select: { name: true } },
              approver: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!team || !team.project) return null;
  const p = team.project;
  const sc = p.showcase && p.showcase.cohortId === cohortId ? p.showcase : null;
  const consentOf = new Map((sc?.consents ?? []).map((c) => [c.userId, c.consentedAt]));
  const members: ShowcaseMember[] = team.members.map((m) => ({
    userId: m.userId,
    name: m.user.name,
    role: m.role,
    isLeader: m.userId === team.leaderId,
    consentedAt: consentOf.has(m.userId) ? formatDateTime(consentOf.get(m.userId)!) : null,
  }));
  const version = sc ? String(sc.updatedAt.getTime()) : "";
  return {
    teamId: team.id,
    teamName: team.name,
    project: {
      title: p.title,
      summary: p.summary,
      problem: parsePlan(p.plan).problem,
      techStack: parseStack(p.techStack),
      repoUrl: p.repoUrl,
      deployUrl: p.deployUrl,
    },
    members,
    showcase: sc && {
      id: sc.id,
      slug: sc.slug,
      status: sc.status,
      problem: sc.problem ?? "",
      metrics: parseMetrics(sc.metrics),
      demoUrl: sc.demoUrl,
      repoUrl: sc.repoUrl,
      coverUrl: sc.coverImagePath ? internalImageHref(cohortId, sc.id, "cover", version) : null,
      architectureUrl: sc.architectureImagePath ? internalImageHref(cohortId, sc.id, "architecture", version) : null,
      reviewNote: sc.reviewNote,
      reviewedBy: sc.reviewer?.name ?? null,
      reviewedAt: sc.instructorReviewedAt ? formatDateTime(sc.instructorReviewedAt) : null,
      approvedBy: sc.approver?.name ?? null,
      approvedAt: sc.approvedAt ? formatDateTime(sc.approvedAt) : null,
      publishedAt: sc.publishedAt ? formatDateTime(sc.publishedAt) : null,
      consentCount: members.filter((m) => m.consentedAt).length,
      allConsented: allConsented(members.length, members.filter((m) => m.consentedAt).length),
      updatedAt: formatDateTime(sc.updatedAt),
    },
  };
}

export type ShowcaseRow = {
  id: number;
  teamName: string;
  projectTitle: string;
  status: ShowcaseStatus;
  consentCount: number;
  memberCount: number;
  reviewed: boolean;
  updatedAt: string;
};

/** 반의 쇼케이스 목록 (교직원 쇼케이스 탭) */
export async function listCohortShowcases(cohortId: number): Promise<ShowcaseRow[]> {
  const rows = await db.showcase.findMany({
    where: { cohortId },
    select: {
      id: true,
      status: true,
      instructorReviewedAt: true,
      updatedAt: true,
      _count: { select: { consents: true } },
      project: { select: { title: true, team: { select: { name: true, _count: { select: { members: true } } } } } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    teamName: r.project.team.name,
    projectTitle: r.project.title,
    status: r.status,
    consentCount: r._count.consents,
    memberCount: r.project.team._count.members,
    reviewed: r.instructorReviewedAt !== null,
    updatedAt: formatDateTime(r.updatedAt),
  }));
}

/** 리소스 단위 권한 검사용: 쇼케이스가 속한 팀 구성원 */
export async function getShowcaseAccessInfo(cohortId: number, showcaseId: number) {
  const sc = await db.showcase.findFirst({
    where: { id: showcaseId, cohortId },
    select: {
      id: true,
      cohortId: true,
      status: true,
      problem: true,
      instructorReviewedAt: true,
      coverImagePath: true,
      architectureImagePath: true,
      _count: { select: { consents: true } },
      project: { select: { team: { select: { members: { select: { userId: true } } } } } },
    },
  });
  if (!sc) return null;
  return {
    id: sc.id,
    cohortId: sc.cohortId,
    status: sc.status,
    hasContent: !!sc.problem?.trim(),
    instructorReviewed: sc.instructorReviewedAt !== null,
    consentCount: sc._count.consents,
    memberIds: sc.project.team.members.map((m) => m.userId),
    imagePaths: { cover: sc.coverImagePath, architecture: sc.architectureImagePath } as Record<ImageKind, string | null>,
  };
}

// ───────── 공개 조회 (로그인 없음) ─────────

/** 공개 DTO를 만들 때 쓰는 유일한 select. 사용자 id는 동의 여부 대조에만 쓰고 DTO에는 넣지 않는다. */
const PUBLIC_SELECT = {
  slug: true,
  status: true,
  problem: true,
  metrics: true,
  demoUrl: true,
  repoUrl: true,
  coverImagePath: true,
  architectureImagePath: true,
  publishedAt: true,
  consents: { select: { userId: true } },
  cohort: { select: { name: true } },
  project: {
    select: {
      title: true,
      summary: true,
      techStack: true,
      team: { select: { name: true, members: { select: { userId: true, role: true, user: { select: { name: true } } }, orderBy: { joinedAt: "asc" as const } } } },
    },
  },
} as const;

type PublicRow = {
  slug: string;
  status: ShowcaseStatus;
  problem: string | null;
  metrics: unknown;
  demoUrl: string | null;
  repoUrl: string | null;
  coverImagePath: string | null;
  architectureImagePath: string | null;
  publishedAt: Date | null;
  consents: Array<{ userId: number }>;
  cohort: { name: string };
  project: {
    title: string;
    summary: string | null;
    techStack: unknown;
    team: { name: string; members: Array<{ userId: number; role: string | null; user: { name: string } }> };
  };
};

function toPublic(r: PublicRow): PublicShowcase | null {
  return toPublicShowcase({
    slug: r.slug,
    status: r.status,
    problem: r.problem,
    metrics: r.metrics,
    demoUrl: r.demoUrl,
    repoUrl: r.repoUrl,
    hasCover: !!r.coverImagePath,
    hasArchitecture: !!r.architectureImagePath,
    publishedAt: r.publishedAt,
    projectTitle: r.project.title,
    projectSummary: r.project.summary,
    techStack: r.project.techStack,
    teamName: r.project.team.name,
    courseName: r.cohort.name,
    members: r.project.team.members.map((m) => ({ userId: m.userId, name: m.user.name, role: m.role })),
    consentedUserIds: r.consents.map((c) => c.userId),
  });
}

/** /market 목록: 공개 승인된 항목만, 최신순. 기술 스택 필터는 카드 수가 적어 메모리에서 거른다. */
export async function listPublicShowcases(tech?: string): Promise<{ items: PublicShowcase[]; stacks: string[] }> {
  const rows = await db.showcase.findMany({ where: { status: "PUBLISHED" }, select: PUBLIC_SELECT, orderBy: { publishedAt: "desc" }, take: 100 });
  const all = rows.map(toPublic).filter((x): x is PublicShowcase => x !== null);
  const stacks = [...new Set(all.flatMap((s) => s.techStack))].sort((a, b) => a.localeCompare(b));
  return { items: tech ? all.filter((s) => s.techStack.includes(tech)) : all, stacks };
}

/** /market/[slug] 상세: PUBLISHED가 아니면 null (존재 여부를 구분하지 않는다) */
export async function getPublicShowcase(slug: string): Promise<PublicShowcase | null> {
  const row = await db.showcase.findFirst({ where: { slug, status: "PUBLISHED" }, select: PUBLIC_SELECT });
  return row ? toPublic(row) : null;
}

/** 공개 이미지 경로: PUBLISHED 쇼케이스의 이미지만 */
export async function getPublicImagePath(slug: string, kind: ImageKind): Promise<string | null> {
  const row = await db.showcase.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: { coverImagePath: true, architectureImagePath: true },
  });
  if (!row) return null;
  return kind === "cover" ? row.coverImagePath : row.architectureImagePath;
}
