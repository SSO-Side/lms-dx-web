// 티켓(M2) 조회 함수: 티켓 목록·상세, 상태별 개수.
import type { Prisma, Role, TicketStatus, TicketType } from "@prisma/client";
import { db } from "@/lib/db";
import { dateToYmd, formatDateTime } from "@/lib/dates";
import { availableTransitions } from "@/lib/tickets/transitions";
import { hasActionPermission } from "@/lib/access/permissions";

// 호출 측이 먼저 requireCohortAccess로 권한을 확인하고 ctx.cohortId만 넘긴다.

export type TicketRow = {
  id: number;
  type: TicketType;
  status: TicketStatus;
  title: string;
  requesterName: string;
  createdAt: string;
  absentDate: string | null;
};

/** 티켓 보드 탭별 상태 묶음(처리 대기·완료 등) */
export const STATUS_GROUPS: Record<string, TicketStatus[]> = {
  PENDING: ["PENDING"],
  IN_REVIEW: ["IN_REVIEW"],
  NEEDS_REVISION: ["NEEDS_REVISION"],
  DONE: ["APPROVED", "REJECTED", "CANCELED"],
};

/** 티켓 목록. 수강생은 본인 것만, 교직원은 반 전체. */
export async function listTickets(
  cohortId: number,
  opts: { requesterId?: number; statuses?: TicketStatus[]; take?: number } = {}
): Promise<TicketRow[]> {
  const where: Prisma.TicketWhereInput = {
    cohortId,
    ...(opts.requesterId ? { requesterId: opts.requesterId } : {}),
    ...(opts.statuses ? { status: { in: opts.statuses } } : {}),
  };
  const tickets = await db.ticket.findMany({
    where,
    include: { requester: { select: { name: true } }, absence: { select: { absentDate: true } } },
    orderBy: { createdAt: "desc" },
    take: opts.take,
  });
  return tickets.map((t) => ({
    id: t.id,
    type: t.type,
    status: t.status,
    title: t.title,
    requesterName: t.requester.name,
    createdAt: formatDateTime(t.createdAt),
    absentDate: t.absence ? dateToYmd(t.absence.absentDate) : null,
  }));
}

/** 상태별 티켓 수(홈 위젯·탭 숫자용). */
export async function countTicketsByStatus(cohortId: number, requesterId?: number) {
  const rows = await db.ticket.groupBy({
    by: ["status"],
    where: { cohortId, ...(requesterId ? { requesterId } : {}) },
    _count: { _all: true },
  });
  const get = (s: TicketStatus) => rows.find((r) => r.status === s)?._count._all ?? 0;
  return {
    PENDING: get("PENDING"),
    IN_REVIEW: get("IN_REVIEW"),
    NEEDS_REVISION: get("NEEDS_REVISION"),
    DONE: get("APPROVED") + get("REJECTED") + get("CANCELED"),
  };
}

export type TicketDetail = {
  id: number;
  type: TicketType;
  status: TicketStatus;
  title: string;
  body: string | null;
  createdAt: string;
  requester: { id: number; name: string; loginId: string };
  assigneeName: string | null;
  absence: { absentDate: string; reasonType: "SICK" | "LEAVE" | "OTHER"; linked: boolean } | null;
  attachmentCount: number;
  /** 증빙 열람 권한이 없으면 null */
  attachments: { id: number; originalName: string; mimeType: string; size: number }[] | null;
  events: { id: number; actorName: string; from: TicketStatus | null; to: TicketStatus; comment: string | null; createdAt: string }[];
  isRequester: boolean;
  actions: { to: TicketStatus; commentRequired: boolean }[];
};

/** 티켓 상세(본문·첨부 파일·처리 이력). */
export async function getTicketDetail(
  cohortId: number,
  ticketId: number,
  viewer: { id: number; role: Role }
): Promise<TicketDetail | null> {
  const t = await db.ticket.findFirst({
    where: { id: ticketId, cohortId },
    include: {
      requester: { select: { id: true, name: true, loginId: true } },
      assignee: { select: { name: true } },
      absence: true,
      attachments: { orderBy: { id: "asc" } },
      events: { include: { actor: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!t) return null;
  const isRequester = t.requesterId === viewer.id;
  // 수강생은 본인 티켓만
  if (viewer.role === "STUDENT" && !isRequester) return null;
  const canSeeProof = hasActionPermission(viewer.role, "absenceProof:read") && (viewer.role !== "STUDENT" || isRequester);

  return {
    id: t.id,
    type: t.type,
    status: t.status,
    title: t.title,
    body: t.body,
    createdAt: formatDateTime(t.createdAt),
    requester: t.requester,
    assigneeName: t.assignee?.name ?? null,
    absence: t.absence
      ? { absentDate: dateToYmd(t.absence.absentDate), reasonType: t.absence.reasonType, linked: t.absence.linkedAttendanceEventId !== null }
      : null,
    attachmentCount: t.attachments.length,
    attachments: canSeeProof
      ? t.attachments.map((a) => ({ id: a.id, originalName: a.originalName, mimeType: a.mimeType, size: a.size }))
      : null,
    events: t.events.map((e) => ({
      id: e.id,
      actorName: e.actor.name,
      from: e.fromStatus,
      to: e.toStatus,
      comment: e.comment,
      createdAt: formatDateTime(e.createdAt),
    })),
    isRequester,
    actions: availableTransitions(t.status, viewer.role, isRequester).map((r) => ({ to: r.to, commentRequired: !!r.commentRequired })),
  };
}

/** 증빙 파일 전달용: 이 반 티켓의 첨부 한 건과 신청자 id (없으면 null) */
export async function getAttachmentForFile(cohortId: number, attachmentId: number) {
  return db.ticketAttachment.findFirst({
    where: { id: attachmentId, ticket: { cohortId } },
    include: { ticket: { select: { requesterId: true } } },
  });
}
