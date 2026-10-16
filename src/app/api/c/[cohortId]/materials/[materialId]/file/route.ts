import { NextResponse } from "next/server";
import { tryCohortAccess } from "@/lib/access/pageAccess";
import { db } from "@/lib/db";
import { fileResponse } from "@/lib/storage/serve";

// 수업 자료 파일 전달: 반 접근(material:read) 확인 → 이 반 자료만 → 서버가 전달한다 (직접 URL 없음).
export async function GET(_req: Request, { params }: { params: Promise<{ cohortId: string; materialId: string }> }) {
  const { cohortId, materialId } = await params;
  const ctx = await tryCohortAccess(cohortId, "material:read");
  const denied = () => new NextResponse("접근할 수 없습니다.", { status: 403 });
  if (!ctx) return denied();

  const id = parseInt(materialId, 10);
  if (!id) return denied();
  const m = await db.material.findFirst({ where: { id, cohortId: ctx.cohortId }, select: { filePath: true, fileName: true, fileMime: true, title: true } });
  if (!m?.filePath || !m.fileMime) return new NextResponse("파일을 찾을 수 없습니다.", { status: 404 });

  return fileResponse({ key: m.filePath, mime: m.fileMime, fileName: m.fileName ?? m.title });
}
