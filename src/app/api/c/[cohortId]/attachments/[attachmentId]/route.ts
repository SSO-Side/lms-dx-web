import { NextResponse } from "next/server";
import { tryCohortAccess } from "@/lib/access/pageAccess";
import { db } from "@/lib/db";
import { readFile } from "@/lib/storage";

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

  const data = await readFile(att.storagePath).catch(() => null);
  if (!data) return new NextResponse("파일을 찾을 수 없습니다.", { status: 404 });

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": att.mimeType,
      "Content-Length": String(data.length),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(att.originalName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
