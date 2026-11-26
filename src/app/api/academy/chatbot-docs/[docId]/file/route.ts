// 학원 공통 챗봇 문서 PDF 열람 API. 학원 문서 관리 권한 확인 → 자기 학원의 공통 문서만 → 서버가 전달한다 (직접 URL 없음).
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { canManageAcademyChatDocsPure } from "@/lib/access/checker";
import { getAcademyChatDocFile } from "@/server/chatbot-queries";
import { fileResponse } from "@/lib/storage/serve";

export async function GET(_req: Request, { params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params;
  const user = await getSessionUser();
  if (!user || !canManageAcademyChatDocsPure(user)) return new NextResponse("접근할 수 없습니다.", { status: 403 });
  const id = parseInt(docId, 10);
  const doc = id ? await getAcademyChatDocFile(user.academyId, id) : null;
  if (!doc) return new NextResponse("파일을 찾을 수 없습니다.", { status: 404 });
  return fileResponse({ key: doc.filePath, mime: "application/pdf", fileName: doc.fileName });
}
