import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getSessionUser } from "@/lib/auth/session";
import { tryCohortAccess } from "@/lib/access/pageAccess";
import { canViewShowcaseInternalPure } from "@/lib/access/checker";
import { isImageKind } from "@/lib/showcase/public";
import { readFile, imageMimeOf } from "@/lib/storage";
import { getShowcaseAccessInfo } from "@/server/showcase-queries";

// LMS 안 쇼케이스 이미지(미공개 포함): 반 접근 확인 → 같은 반 팀원·강사·매니저·슈퍼어드민만 → 서버가 전달.
export async function GET(_req: Request, { params }: { params: Promise<{ cohortId: string; showcaseId: string; kind: string }> }) {
  const { cohortId, showcaseId, kind } = await params;
  const denied = () => new NextResponse("접근할 수 없습니다.", { status: 403 });
  const user = await getSessionUser();
  if (!user || !isImageKind(kind)) return denied();
  const key = user.role === Role.STUDENT ? "showcase:apply" : user.role === Role.INSTRUCTOR ? "showcase:review" : "showcase:approve";
  const ctx = await tryCohortAccess(cohortId, key);
  if (!ctx) return denied();

  const id = parseInt(showcaseId, 10);
  const sc = id ? await getShowcaseAccessInfo(ctx.cohortId, id) : null;
  if (!sc || !canViewShowcaseInternalPure({ id: ctx.user.id, role: ctx.role }, ctx.cohortId, sc)) return denied();

  const path = sc.imagePaths[kind];
  const mime = path ? imageMimeOf(path) : null;
  const data = path && mime ? await readFile(path).catch(() => null) : null;
  if (!data || !mime) return new NextResponse("파일을 찾을 수 없습니다.", { status: 404 });

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(data.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
