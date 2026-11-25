// 챗봇 매뉴얼 PDF 열람 API. 관리 권한(chatDoc:manage) 확인 → 이 반·학원 문서만 → 서버가 전달한다 (직접 URL 없음).
import { NextResponse } from "next/server";
import { tryCohortAccess } from "@/lib/access/pageAccess";
import { getCohortAcademyId, getChatDocFile } from "@/server/chatbot-queries";
import { fileResponse } from "@/lib/storage/serve";

export async function GET(_req: Request, { params }: { params: Promise<{ cohortId: string; docId: string }> }) {
  const { cohortId, docId } = await params;
  const ctx = await tryCohortAccess(cohortId, "chatDoc:manage");
  const denied = () => new NextResponse("접근할 수 없습니다.", { status: 403 });
  if (!ctx) return denied();
  const id = parseInt(docId, 10);
  const academyId = await getCohortAcademyId(ctx.cohortId);
  if (!id || !academyId) return denied();
  const doc = await getChatDocFile(academyId, ctx.cohortId, id);
  if (!doc) return new NextResponse("파일을 찾을 수 없습니다.", { status: 404 });
  return fileResponse({ key: doc.filePath, mime: "application/pdf", fileName: doc.fileName });
}
