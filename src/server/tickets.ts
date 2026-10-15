"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { EnrollmentStatus, LogAction, type Prisma, type TicketStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireCohortAccess, AccessDeniedError } from "@/lib/access/requireCohortAccess";
import { tryCohortAccess } from "@/lib/access/pageAccess";
import { isYmd, ymdToDate, dateToYmd } from "@/lib/dates";
import { canTransition } from "@/lib/tickets/transitions";
import { PROOF_MAX_BYTES, PROOF_TYPES, resolveProofMime, saveFile, deleteFile } from "@/lib/storage";
import { getTicketDetail, type TicketDetail } from "./ticket-queries";

type Result = { ok: true; ticketId?: number } | { ok: false; error: string };

const REASON_LABELS = { SICK: "병결", LEAVE: "휴가", OTHER: "기타" } as const;
const MAX_FILES = 3;

async function wrap(fn: () => Promise<Result>): Promise<Result> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AccessDeniedError) return { ok: false, error: "권한이 없습니다." };
    throw e;
  }
}

function refresh(cohortId: number) {
  revalidatePath(`/app/c/${cohortId}/tickets`);
  revalidatePath(`/app/c/${cohortId}/attendance`);
  revalidatePath(`/app/c/${cohortId}`);
}

type StoredFile = { storagePath: string; originalName: string; mimeType: string; size: number };

/** 증빙 파일 검증 후 저장. 실패하면 이미 저장한 파일을 지운다. */
async function storeProofs(cohortId: number, files: File[]): Promise<StoredFile[] | string> {
  const real = files.filter((f) => f && typeof f === "object" && f.size > 0);
  if (real.length > MAX_FILES) return `증빙은 최대 ${MAX_FILES}개까지 첨부할 수 있습니다.`;
  for (const f of real) {
    if (!resolveProofMime(f)) return `${f.name}: 이미지(jpg, png, heic) 또는 pdf만 첨부할 수 있습니다.`;
    if (f.size > PROOF_MAX_BYTES) return `${f.name}: 파일당 10MB 이하만 첨부할 수 있습니다.`;
  }
  const stored: StoredFile[] = [];
  try {
    for (const f of real) {
      const mime = resolveProofMime(f)!;
      const storagePath = await saveFile(`proofs/${cohortId}`, Buffer.from(await f.arrayBuffer()), PROOF_TYPES[mime]);
      stored.push({ storagePath, originalName: f.name.slice(0, 255), mimeType: mime, size: f.size });
    }
  } catch (e) {
    await Promise.all(stored.map((s) => deleteFile(s.storagePath)));
    throw e;
  }
  return stored;
}

/** 주담당 매니저 (없으면 null → 슈퍼어드민 처리) */
async function primaryManagerId(cohortId: number): Promise<number | null> {
  const staff = await db.cohortStaff.findFirst({ where: { cohortId, staffRole: "MANAGER", isPrimary: true }, select: { userId: true } });
  return staff?.userId ?? null;
}

const absenceSchema = z.object({
  absentDate: z.string().refine(isYmd, "결석 일자를 선택해 주세요."),
  reasonType: z.enum(["SICK", "LEAVE", "OTHER"], { message: "사유 유형을 선택해 주세요." }),
  body: z.string().trim().max(2000).optional(),
});

/** 결석계 접수 (수강생) */
export async function createAbsenceAction(cohortId: number, formData: FormData): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "ticket:create");
    const parsed = absenceSchema.safeParse({
      absentDate: formData.get("absentDate"),
      reasonType: formData.get("reasonType"),
      body: (formData.get("body") as string) || undefined,
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "입력값 오류" };
    const { absentDate, reasonType, body } = parsed.data;
    const d = ymdToDate(absentDate);

    const [day, enrollment, dup] = await Promise.all([
      db.trainingDay.findUnique({ where: { cohortId_date: { cohortId: ctx.cohortId, date: d } } }),
      db.enrollment.findUnique({ where: { cohortId_studentId: { cohortId: ctx.cohortId, studentId: ctx.user.id } } }),
      db.ticket.findFirst({
        where: {
          cohortId: ctx.cohortId,
          requesterId: ctx.user.id,
          type: "ABSENCE",
          status: { notIn: ["REJECTED", "CANCELED"] },
          absence: { absentDate: d },
        },
        select: { id: true },
      }),
    ]);
    if (ctx.role !== "ADMIN" && enrollment?.status !== EnrollmentStatus.ENROLLED) return { ok: false, error: "이 반의 재적 수강생만 접수할 수 있습니다." };
    if (!day || !day.isTraining) return { ok: false, error: "훈련일이 아닌 날짜입니다." };
    if (dup) return { ok: false, error: `같은 날짜의 결석계(#${dup.id})가 이미 있습니다.` };

    const stored = await storeProofs(ctx.cohortId, formData.getAll("files") as File[]);
    if (typeof stored === "string") return { ok: false, error: stored };

    const assigneeId = await primaryManagerId(ctx.cohortId);
    const ticket = await db.ticket.create({
      data: {
        cohortId: ctx.cohortId,
        type: "ABSENCE",
        requesterId: ctx.user.id,
        assigneeId,
        title: `결석계 · ${absentDate} (${REASON_LABELS[reasonType]})`,
        body: body || null,
        absence: { create: { absentDate: d, reasonType } },
        attachments: { create: stored },
        events: { create: { actorId: ctx.user.id, fromStatus: null, toStatus: "PENDING" } },
      },
    });
    refresh(ctx.cohortId);
    return { ok: true, ticketId: ticket.id };
  });
}

const inquirySchema = z.object({
  type: z.enum(["COUNSELING", "DOCUMENT", "OTHER"]),
  title: z.string().trim().min(1, "제목을 입력해 주세요.").max(200),
  body: z.string().trim().max(5000).optional(),
});

/** 상담·서류·기타 문의 (수강생) */
export async function createInquiryAction(cohortId: number, formData: FormData): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "ticket:create");
    const parsed = inquirySchema.safeParse({
      type: formData.get("type"),
      title: formData.get("title"),
      body: (formData.get("body") as string) || undefined,
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "입력값 오류" };
    const assigneeId = await primaryManagerId(ctx.cohortId);
    const ticket = await db.ticket.create({
      data: {
        cohortId: ctx.cohortId,
        type: parsed.data.type,
        requesterId: ctx.user.id,
        assigneeId,
        title: parsed.data.title,
        body: parsed.data.body || null,
        events: { create: { actorId: ctx.user.id, fromStatus: null, toStatus: "PENDING" } },
      },
    });
    refresh(ctx.cohortId);
    return { ok: true, ticketId: ticket.id };
  });
}

const STUDENT_TARGETS: TicketStatus[] = ["PENDING", "CANCELED"];

/** 상태 전이. 허용되지 않은 전이는 서버에서 거부한다. */
export async function transitionTicketAction(
  cohortId: number,
  ticketId: number,
  to: TicketStatus,
  comment?: string | null,
  files?: FormData
): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, STUDENT_TARGETS.includes(to) ? "ticket:create" : "ticket:process");
    const ticket = await db.ticket.findFirst({
      where: { id: ticketId, cohortId: ctx.cohortId },
      include: { absence: true },
    });
    if (!ticket) return { ok: false, error: "티켓을 찾을 수 없습니다." };

    const check = canTransition(ticket.status, to, ctx.role, { isRequester: ticket.requesterId === ctx.user.id, comment });
    if (!check.ok) {
      const msg = {
        NOT_ALLOWED: "현재 상태에서 할 수 없는 처리입니다.",
        NOT_REQUESTER: "요청자 본인만 할 수 있습니다.",
        COMMENT_REQUIRED: "사유를 입력해 주세요.",
      }[check.reason];
      return { ok: false, error: msg };
    }

    // 재제출 시 보완 증빙 추가
    let stored: StoredFile[] = [];
    if (to === "PENDING" && files && ticket.type === "ABSENCE") {
      const r = await storeProofs(ctx.cohortId, files.getAll("files") as File[]);
      if (typeof r === "string") return { ok: false, error: r };
      const existing = await db.ticketAttachment.count({ where: { ticketId } });
      if (existing + r.length > MAX_FILES * 2) {
        await Promise.all(r.map((s) => deleteFile(s.storagePath)));
        return { ok: false, error: "증빙이 너무 많습니다." };
      }
      stored = r;
    }

    await db.$transaction(async (tx) => {
      // 낙관적 동시성: 상태가 그사이 바뀌었으면 실패
      const updated = await tx.ticket.updateMany({ where: { id: ticket.id, status: ticket.status }, data: { status: to } });
      if (updated.count !== 1) throw new Error("STALE");
      await tx.ticketEvent.create({
        data: { ticketId: ticket.id, actorId: ctx.user.id, fromStatus: ticket.status, toStatus: to, comment: comment?.trim() || null },
      });
      if (stored.length) {
        await tx.ticketAttachment.createMany({ data: stored.map((s) => ({ ticketId: ticket.id, ...s })) });
      }
      if (to === "APPROVED" && ticket.type === "ABSENCE" && ticket.absence && ticket.absence.reasonType !== "OTHER") {
        await linkApprovedAbsence(tx, ctx.cohortId, ctx.user.id, ticket.id, ticket.requesterId, ticket.absence);
      }
    }).catch((e) => {
      if (e instanceof Error && e.message === "STALE") return Promise.reject(new StaleError());
      throw e;
    });

    refresh(ctx.cohortId);
    return { ok: true, ticketId: ticket.id };
  }).catch((e) => {
    if (e instanceof StaleError) return { ok: false as const, error: "다른 사람이 먼저 처리했습니다. 새로고침해 주세요." };
    throw e;
  });
}

class StaleError extends Error {}

/** 승인된 결석계 → 해당 일자 공결 결석 이벤트 (attendance.md §6) */
async function linkApprovedAbsence(
  tx: Prisma.TransactionClient,
  cohortId: number,
  actorId: number,
  ticketId: number,
  studentId: number,
  absence: { id: number; absentDate: Date; reasonType: "SICK" | "LEAVE" | "OTHER" }
) {
  const excusedType = absence.reasonType === "SICK" ? "SICK" : "LEAVE";
  const key = { cohortId_studentId_date_type: { cohortId, studentId, date: absence.absentDate, type: "ABSENT" as const } };
  const prev = await tx.attendanceEvent.findUnique({ where: key });
  const snap = (e: { studentId: number; date: Date; type: string; excused: boolean; excusedType: string | null; ticketId: number | null; note: string | null }) => ({
    studentId: e.studentId,
    date: dateToYmd(e.date),
    type: e.type,
    excused: e.excused,
    excusedType: e.excusedType,
    ticketId: e.ticketId,
    note: e.note,
  });

  // 같은 날 지각·조퇴 기록은 결석과 함께 둘 수 없으므로 정리한다
  const others = await tx.attendanceEvent.findMany({ where: { cohortId, studentId, date: absence.absentDate, type: { not: "ABSENT" } } });
  for (const o of others) {
    await tx.attendanceEvent.delete({ where: { id: o.id } });
    await tx.attendanceEventLog.create({ data: { cohortId, eventId: o.id, action: LogAction.DELETE, actorId, before: snap(o) } });
  }

  let eventId: number;
  if (prev) {
    const updated = await tx.attendanceEvent.update({
      where: { id: prev.id },
      data: { excused: true, excusedType, ticketId, recordedById: actorId },
    });
    await tx.attendanceEventLog.create({
      data: { cohortId, eventId: prev.id, action: LogAction.UPDATE, actorId, before: snap(prev), after: snap(updated) },
    });
    eventId = prev.id;
  } else {
    const created = await tx.attendanceEvent.create({
      data: { cohortId, studentId, date: absence.absentDate, type: "ABSENT", excused: true, excusedType, ticketId, recordedById: actorId, note: `결석계 #${ticketId}` },
    });
    await tx.attendanceEventLog.create({ data: { cohortId, eventId: created.id, action: LogAction.CREATE, actorId, after: snap(created) } });
    eventId = created.id;
  }
  await tx.absenceDetail.update({ where: { id: absence.id }, data: { linkedAttendanceEventId: eventId } });
}

/** 드로어용 상세 */
export async function getTicketDetailAction(
  cohortId: number,
  ticketId: number
): Promise<{ ok: true; detail: TicketDetail } | { ok: false; error: string }> {
  const own = await tryCohortAccess(cohortId, "ticket:readOwn");
  const ctx = own && own.role === "STUDENT" ? own : await tryCohortAccess(cohortId, "ticket:readCohort");
  if (!ctx) return { ok: false, error: "권한이 없습니다." };
  const detail = await getTicketDetail(ctx.cohortId, ticketId, { id: ctx.user.id, role: ctx.role });
  if (!detail) return { ok: false, error: "티켓을 찾을 수 없습니다." };
  return { ok: true, detail };
}

/** 증빙 목록 (증빙 모달용). 본인 또는 반의 MANAGER·ACADEMY_ADMIN만. */
export async function listProofsAction(cohortId: number, ticketId: number) {
  const ctx = await tryCohortAccess(cohortId, "absenceProof:read");
  if (!ctx) return { ok: false as const, error: "증빙을 열람할 권한이 없습니다." };
  const ticket = await db.ticket.findFirst({
    where: { id: ticketId, cohortId: ctx.cohortId },
    select: { requesterId: true, attachments: { select: { id: true, originalName: true, mimeType: true, size: true }, orderBy: { id: "asc" } } },
  });
  if (!ticket || (ctx.role === "STUDENT" && ticket.requesterId !== ctx.user.id)) {
    return { ok: false as const, error: "증빙을 열람할 권한이 없습니다." };
  }
  return { ok: true as const, attachments: ticket.attachments };
}
