// 권한 확인을 마친 라우트에서 파일을 내려주는 공통 응답.
// STORAGE_ACCEL_PREFIX(예: /_files)가 있으면 본문 대신 X-Accel-Redirect를 돌려 Nginx가 공유 볼륨에서 직접 전송한다(local 드라이버 전용).
import { NextResponse } from "next/server";
import { getStorage, readFile, isInlineMime } from "./index";
import { assertValidKey } from "./types";

export type ServeOptions = {
  key: string;
  mime: string;
  fileName: string;
  /** 생략하면 PDF·이미지는 바로 열기, 그 외는 내려받기 */
  inline?: boolean;
  cacheControl?: string;
};

/** 권한 확인을 마친 파일을 응답으로 내려준다(보안 헤더 포함). */
export async function fileResponse({ key, mime, fileName, inline, cacheControl = "private, no-store" }: ServeOptions): Promise<NextResponse> {
  const disposition = (inline ?? isInlineMime(mime)) ? "inline" : "attachment";
  const headers: Record<string, string> = {
    "Content-Type": mime,
    "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
  };
  // 브라우저 PDF 뷰어가 CSP에 막히는 경우가 있어 PDF 외에만 건다.
  if (mime !== "application/pdf") headers["Content-Security-Policy"] = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'";

  const accel = process.env.STORAGE_ACCEL_PREFIX;
  if (accel && getStorage().name === "local") {
    assertValidKey(key);
    return new NextResponse(null, { headers: { ...headers, "X-Accel-Redirect": `${accel.replace(/\/$/, "")}/${key}` } });
  }

  const data = await readFile(key).catch(() => null);
  if (!data) return new NextResponse("파일을 찾을 수 없습니다.", { status: 404 });
  return new NextResponse(new Uint8Array(data), { headers: { ...headers, "Content-Length": String(data.length) } });
}
