// 과제 제출 파일 내려받기 API (/api/c/[cohortId]/submissions/[id]/file).
import { NextResponse } from "next/server";
import { tryCohortAccess } from "@/lib/access/pageAccess";
import { canViewSubmissionFilePure } from "@/lib/access/checker";
import { db } from "@/lib/db";
import { fileResponse } from "@/lib/storage/serve";

// 과제 제출 파일 전달: 반 접근(assignment:read) → 수강생은 본인 것만, 교직원은 같은 반 → 서버가 전달한다 (직접 URL 없음).
export async function GET(_req: Request, { params }: { params: Promise<{ cohortId: string; submissionId: string }> }) {
  const { cohortId, submissionId } = await params;
  const ctx = await tryCohortAccess(cohortId, "assignment:read");
  const denied = () => new NextResponse("접근할 수 없습니다.", { status: 403 });
  if (!ctx) return denied();

  const id = parseInt(submissionId, 10);
  if (!id) return denied();
  const s = await db.submission.findFirst({
    where: { id, cohortId: ctx.cohortId },
    select: { cohortId: true, studentId: true, filePath: true, fileName: true, fileMime: true },
  });
  if (!s || !canViewSubmissionFilePure({ id: ctx.user.id, role: ctx.role }, ctx.cohortId, s)) return denied();
  if (!s.filePath || !s.fileMime) return new NextResponse("파일을 찾을 수 없습니다.", { status: 404 });

  return fileResponse({ key: s.filePath, mime: s.fileMime, fileName: s.fileName ?? "제출 파일" });
}
