import { NextResponse } from "next/server";
import { isImageKind } from "@/lib/showcase/public";
import { imageMimeOf } from "@/lib/storage";
import { fileResponse } from "@/lib/storage/serve";
import { getPublicImagePath } from "@/server/showcase-queries";

// 공개 이미지: PUBLISHED 쇼케이스의 대표·아키텍처 이미지만 (로그인 없음). 미공개·없는 항목은 같은 404.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; kind: string }> }) {
  const { slug, kind } = await params;
  const notFound = () => new NextResponse("찾을 수 없습니다.", { status: 404 });
  if (!isImageKind(kind) || slug.length > 40) return notFound();

  const path = await getPublicImagePath(slug, kind);
  const mime = path ? imageMimeOf(path) : null;
  if (!path || !mime) return notFound();
  // 비공개 전환이 곧 반영되도록 짧게만 캐시
  return fileResponse({ key: path, mime, fileName: `${kind}.${path.split(".").pop()}`, inline: true, cacheControl: "public, max-age=60" });
}
