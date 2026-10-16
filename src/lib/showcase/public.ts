// 공개 영역(/market) 데이터 규칙 (순수 함수). 공개 응답은 여기서 만든 DTO만 쓴다.
import crypto from "crypto";
import type { ShowcaseStatus } from "@prisma/client";
import { todayYmd } from "@/lib/dates";

export type Metric = { label: string; value: string };
export type ImageKind = "cover" | "architecture";
export const IMAGE_KINDS: ImageKind[] = ["cover", "architecture"];

export function isImageKind(v: string): v is ImageKind {
  return (IMAGE_KINDS as string[]).includes(v);
}

/** 공개 라우트에 노출 가능한 상태는 PUBLISHED 하나뿐 */
export function isPubliclyVisible(status: ShowcaseStatus): boolean {
  return status === "PUBLISHED";
}

const SLUG_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** 추측하기 어려운 슬러그: 난수 12자 (31^12 ≈ 8×10^17) */
export function generateSlug(bytes: Uint8Array = crypto.randomBytes(12)): string {
  return Array.from(bytes, (b) => SLUG_ALPHABET[b % SLUG_ALPHABET.length]).join("");
}

export function parseMetrics(v: unknown): Metric[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((m): m is Metric => !!m && typeof m === "object" && typeof (m as Metric).label === "string" && typeof (m as Metric).value === "string")
    .slice(0, 6);
}

export function parseStack(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string").slice(0, 12) : [];
}

export type PublicShowcaseSource = {
  slug: string;
  status: ShowcaseStatus;
  problem: string | null;
  metrics: unknown;
  demoUrl: string | null;
  repoUrl: string | null;
  hasCover: boolean;
  hasArchitecture: boolean;
  publishedAt: Date | null;
  projectTitle: string;
  projectSummary: string | null;
  techStack: unknown;
  teamName: string;
  courseName: string;
  members: Array<{ userId: number; name: string; role: string | null }>;
  consentedUserIds: number[];
};

/** 공개 카드·상세 DTO. 사용자 ID·로그인 ID·연락처·반 ID 같은 내부 값은 담지 않는다. */
export type PublicShowcase = {
  slug: string;
  title: string;
  summary: string;
  problem: string;
  metrics: Metric[];
  demoUrl: string | null;
  repoUrl: string | null;
  techStack: string[];
  teamName: string;
  courseName: string;
  /** 공개에 동의한 팀원만 (이름·역할) */
  members: Array<{ name: string; role: string | null }>;
  coverUrl: string | null;
  architectureUrl: string | null;
  publishedAt: string | null;
};

export function publicImageHref(slug: string, kind: ImageKind) {
  return `/api/market/${slug}/images/${kind}`;
}

/** PUBLISHED가 아니면 null. 동의하지 않은 팀원은 이름·역할 모두 빠진다. */
export function toPublicShowcase(src: PublicShowcaseSource): PublicShowcase | null {
  if (!isPubliclyVisible(src.status)) return null;
  const consented = new Set(src.consentedUserIds);
  return {
    slug: src.slug,
    title: src.projectTitle,
    summary: src.projectSummary ?? "",
    problem: src.problem ?? "",
    metrics: parseMetrics(src.metrics),
    demoUrl: src.demoUrl,
    repoUrl: src.repoUrl,
    techStack: parseStack(src.techStack),
    teamName: src.teamName,
    courseName: src.courseName,
    members: src.members.filter((m) => consented.has(m.userId)).map((m) => ({ name: m.name, role: m.role })),
    coverUrl: src.hasCover ? publicImageHref(src.slug, "cover") : null,
    architectureUrl: src.hasArchitecture ? publicImageHref(src.slug, "architecture") : null,
    publishedAt: src.publishedAt ? todayYmd(src.publishedAt) : null, // Asia/Seoul 날짜
  };
}
