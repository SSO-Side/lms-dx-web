// 서류(M7) 조회 함수: 내 서류·반 서류 목록, 상세, 상태별 개수, 반·학원 진행 현황.
import { EnrollmentStatus, type DocumentStatus, type DocumentType } from "@prisma/client";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { studentStage, countStages, type StageCounts, type StudentStage } from "@/lib/documents/summary";

// 호출 측이 먼저 requireCohortAccess로 권한을 확인하고 ctx.cohortId만 넘긴다.

export type DocumentVersionRow = { id: number; versionNo: number; fileName: string; size: number; createdAt: string; aiConsent: boolean };
export type ReviewNoteRow = { id: number; reviewerName: string; comment: string; createdAt: string };

export type DocumentDetail = {
  id: number;
  type: DocumentType;
  title: string;
  status: DocumentStatus;
  updatedAt: string;
  owner: { name: string; loginId: string };
  versions: DocumentVersionRow[];
  notes: ReviewNoteRow[];
};

const detailInclude = {
  owner: { select: { name: true, loginId: true } },
  versions: { orderBy: { versionNo: "desc" as const } },
  reviewNotes: { include: { reviewer: { select: { name: true } } }, orderBy: { createdAt: "desc" as const } },
};

type DocWithDetail = Awaited<ReturnType<typeof findDetail>>[number];

function findDetail(where: { cohortId: number; ownerId?: number; id?: number }) {
  return db.document.findMany({ where, include: detailInclude, orderBy: { updatedAt: "desc" } });
}

function toDetail(d: DocWithDetail): DocumentDetail {
  return {
    id: d.id,
    type: d.type,
    title: d.title,
    status: d.status,
    updatedAt: formatDateTime(d.updatedAt),
    owner: d.owner,
    versions: d.versions.map((v) => ({
      id: v.id,
      versionNo: v.versionNo,
      fileName: v.fileName,
      size: v.size,
      createdAt: formatDateTime(v.createdAt),
      aiConsent: v.aiConsentAt !== null,
    })),
    notes: d.reviewNotes.map((n) => ({ id: n.id, reviewerName: n.reviewer.name, comment: n.comment, createdAt: formatDateTime(n.createdAt) })),
  };
}

/** 수강생 본인의 서류 (버전·코멘트 포함) */
export async function listMyDocuments(cohortId: number, ownerId: number): Promise<DocumentDetail[]> {
  return (await findDetail({ cohortId, ownerId })).map(toDetail);
}

/** 강사 드로어용 상세 */
export async function getDocumentDetail(cohortId: number, documentId: number): Promise<DocumentDetail | null> {
  const [d] = await findDetail({ cohortId, id: documentId });
  return d ? toDetail(d) : null;
}

export type CohortDocumentRow = {
  id: number;
  ownerName: string;
  ownerLoginId: string;
  type: DocumentType;
  title: string;
  status: DocumentStatus;
  versionCount: number;
  updatedAt: string;
};

/** 반 수강생 서류 목록 (강사 표). 재적 수강생의 서류만. */
export async function listCohortDocuments(cohortId: number, status?: DocumentStatus): Promise<CohortDocumentRow[]> {
  const docs = await db.document.findMany({
    where: { cohortId, ...(status ? { status } : {}), owner: { enrollments: { some: { cohortId, status: EnrollmentStatus.ENROLLED } } } },
    include: { owner: { select: { name: true, loginId: true } }, _count: { select: { versions: true } } },
    orderBy: [{ updatedAt: "desc" }],
  });
  return docs.map((d) => ({
    id: d.id,
    ownerName: d.owner.name,
    ownerLoginId: d.owner.loginId,
    type: d.type,
    title: d.title,
    status: d.status,
    versionCount: d._count.versions,
    updatedAt: formatDateTime(d.updatedAt),
  }));
}

/** 서류 상태별 개수(홈 위젯용). */
export async function countDocumentsByStatus(cohortId: number): Promise<Record<DocumentStatus, number>> {
  const rows = await db.document.groupBy({
    by: ["status"],
    where: { cohortId, owner: { enrollments: { some: { cohortId, status: EnrollmentStatus.ENROLLED } } } },
    _count: { _all: true },
  });
  const get = (s: DocumentStatus) => rows.find((r) => r.status === s)?._count._all ?? 0;
  return { DRAFT: get("DRAFT"), IN_REVIEW: get("IN_REVIEW"), DONE: get("DONE") };
}

export type StudentDocumentStatusRow = {
  studentId: number;
  name: string;
  loginId: string;
  stage: StudentStage;
  /** 유형별 가장 최근 서류의 상태 (없으면 null) */
  byType: Record<DocumentType, DocumentStatus | null>;
  updatedAt: string | null;
};

/** 수강생별 서류 상태 (매니저·슈퍼어드민 현황, 위젯). 파일 정보는 담지 않는다. */
export async function getCohortDocumentStatus(cohortId: number): Promise<{ rows: StudentDocumentStatusRow[]; stages: StageCounts }> {
  const enrollments = await db.enrollment.findMany({
    where: { cohortId, status: EnrollmentStatus.ENROLLED },
    select: {
      student: {
        select: {
          id: true,
          name: true,
          loginId: true,
          documents: { where: { cohortId }, select: { type: true, status: true, updatedAt: true }, orderBy: { updatedAt: "desc" } },
        },
      },
    },
    orderBy: { student: { name: "asc" } },
  });
  const rows = enrollments.map(({ student: s }) => {
    const byType: Record<DocumentType, DocumentStatus | null> = { RESUME: null, COVER_LETTER: null, PORTFOLIO: null };
    for (const d of s.documents) if (byType[d.type] === null) byType[d.type] = d.status;
    return {
      studentId: s.id,
      name: s.name,
      loginId: s.loginId,
      stage: studentStage(s.documents.map((d) => d.status)),
      byType,
      updatedAt: s.documents[0] ? formatDateTime(s.documents[0].updatedAt) : null,
    };
  });
  return { rows, stages: countStages(rows.map((r) => r.stage)) };
}

export type CohortStageRow = { cohortId: number; name: string; enrolled: number; stages: StageCounts };

/** 같은 학원의 반별 서류 단계 인원 (슈퍼어드민 현황). academyId는 호출 측이 반 접근 확인 후 넘긴다. */
export async function getAcademyDocumentStatus(academyId: number): Promise<CohortStageRow[]> {
  const cohorts = await db.cohort.findMany({ where: { academyId }, select: { id: true, name: true }, orderBy: { id: "asc" } });
  return Promise.all(
    cohorts.map(async (c) => {
      const { rows, stages } = await getCohortDocumentStatus(c.id);
      return { cohortId: c.id, name: c.name, enrolled: rows.length, stages };
    })
  );
}

/** 서류 PDF 전달용: 이 반 서류 버전 한 건과 소유자 (없으면 null) */
export async function getDocumentVersionForFile(cohortId: number, versionId: number) {
  return db.documentVersion.findFirst({
    where: { id: versionId, cohortId },
    include: { document: { select: { cohortId: true, ownerId: true } } },
  });
}
