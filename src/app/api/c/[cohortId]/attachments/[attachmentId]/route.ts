// 결석계 증빙 파일 내려받기 API (/api/c/[cohortId]/attachments/[id]).
import { NextResponse } from "next/server";
import { tryCohortAccess } from "@/lib/access/pageAccess";
import { db } from "@/lib/db";
import { fileResponse } from "@/lib/storage/serve";

// 증빙 파일 전달: 권한 확인 후 서버가 읽어서 내려준다 (직접 URL 없음).
export async function GET(_req: Request, { params }: { params: Promise<{ cohortId: string; attachmentId: string }> }) {
  const { cohortId, attachmentId } = await params;
  const ctx = await tryCohortAccess(cohortId, "absenceProof:read");
  const denied = () => new NextResponse("접근할 수 없습니다.", { status: 403 });
  if (!ctx) return denied();

  const id = parseInt(attachmentId, 10);
  if (!id) return denied();
  const att = await db.ticketAttachment.findFirst({
    where: { id, ticket: { cohortId: ctx.cohortId } },
    include: { ticket: { select: { requesterId: true } } },
  });
  if (!att || (ctx.role === "STUDENT" && att.ticket.requesterId !== ctx.user.id)) return denied();

  return fileResponse({ key: att.storagePath, mime: att.mimeType, fileName: att.originalName, inline: true });
}
