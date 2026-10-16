import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getSessionUser } from "@/lib/auth/session";
import { tryCohortAccess } from "@/lib/access/pageAccess";
import { canViewDocumentFilePure } from "@/lib/access/checker";
import { db } from "@/lib/db";
import { fileResponse } from "@/lib/storage/serve";

// 서류 PDF 전달: 반 접근 확인 → 본인 또는 같은 반 강사만 → 서버가 읽어서 내려준다 (직접 URL 없음).
// 매니저·슈퍼어드민은 resume:review가 없어 거부된다 (상태만 열람).
export async function GET(_req: Request, { params }: { params: Promise<{ cohortId: string; versionId: string }> }) {
  const { cohortId, versionId } = await params;
  const denied = () => new NextResponse("접근할 수 없습니다.", { status: 403 });
  const user = await getSessionUser();
  if (!user) return denied();
  const ctx = await tryCohortAccess(cohortId, user.role === Role.STUDENT ? "resume:own" : "resume:review");
  if (!ctx) return denied();

  const id = parseInt(versionId, 10);
  if (!id) return denied();
  const version = await db.documentVersion.findFirst({
    where: { id, cohortId: ctx.cohortId },
    include: { document: { select: { cohortId: true, ownerId: true } } },
  });
  if (!version || !canViewDocumentFilePure({ id: ctx.user.id, role: ctx.role }, ctx.cohortId, version.document)) return denied();

  return fileResponse({ key: version.storagePath, mime: "application/pdf", fileName: version.fileName, inline: true });
}
