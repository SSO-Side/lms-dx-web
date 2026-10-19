// 업로드 파일 검증 (순수 함수). 확장자·MIME은 참고만 하고, 가능한 형식은 파일 앞부분 시그니처로 확인한다.

/** 결석계 증빙 파일 한도(10MB) */
export const PROOF_MAX_BYTES = 10 * 1024 * 1024;
/** 결석계 증빙 허용 형식(MIME → 확장자) */
export const PROOF_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "image/heif": "heic",
  "application/pdf": "pdf",
};
const EXT_MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", pdf: "application/pdf" };

/** 허용 형식이면 저장할 mime, 아니면 null. 브라우저가 heic mime을 비워 보내는 경우 확장자로 판단한다. */
export function resolveProofMime(file: { type: string; name: string }): string | null {
  if (PROOF_TYPES[file.type]) return file.type === "image/heif" ? "image/heic" : file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MIME[ext] ?? null;
}

/** 서류 PDF 한도(10MB) */
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

/** 서류 PDF 검사: 확장자 .pdf, MIME application/pdf(비어 있으면 허용), 파일 앞 5바이트 %PDF- 시그니처. 통과하면 null. */
export function checkPdf(file: { name: string; type: string; size: number }, head: Buffer): string | null {
  if (!file.name.toLowerCase().endsWith(".pdf")) return "PDF 파일(.pdf)만 올릴 수 있습니다.";
  if (file.type && file.type !== "application/pdf") return "PDF 파일만 올릴 수 있습니다.";
  if (file.size <= 0) return "빈 파일입니다.";
  if (file.size > DOCUMENT_MAX_BYTES) return "파일은 10MB 이하만 올릴 수 있습니다.";
  if (head.subarray(0, 5).toString("latin1") !== "%PDF-") return "올바른 PDF 파일이 아닙니다.";
  return null;
}

/** 쇼케이스 이미지 한도(5MB) */
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
/** 쇼케이스 이미지 확장자 → MIME */
export const IMAGE_MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

/** 파일 앞부분 시그니처로 형식 판별 (확장자·MIME은 믿지 않는다). png·jpg·webp만. */
export function detectImage(head: Buffer): "png" | "jpg" | "webp" | null {
  if (head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "jpg";
  if (head.length >= 12 && head.subarray(0, 4).toString("latin1") === "RIFF" && head.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  return null;
}

/** 쇼케이스 이미지 검사: 5MB 이하, 시그니처가 png·jpg·webp. 통과하면 저장할 확장자, 아니면 오류 문구. */
export function checkImage(file: { size: number }, head: Buffer): { ext: "png" | "jpg" | "webp" } | string {
  if (file.size <= 0) return "빈 파일입니다.";
  if (file.size > IMAGE_MAX_BYTES) return "이미지는 5MB 이하만 올릴 수 있습니다.";
  const ext = detectImage(head);
  if (!ext) return "PNG, JPG, WEBP 이미지만 올릴 수 있습니다.";
  return { ext };
}

/** 저장 경로의 확장자로 전달할 MIME (이미지 외 경로면 null) */
export function imageMimeOf(relPath: string): string | null {
  return IMAGE_MIME[relPath.split(".").pop()?.toLowerCase() ?? ""] ?? null;
}

// ───────── 커리큘럼 자료·과제 제출 파일 ─────────

/** 자료·제출 파일 한도. 서버 액션 본문 한도(next.config 32MB)와 Nginx client_max_body_size보다 작게 둔다. */
export const COURSE_FILE_MAX_BYTES = 20 * 1024 * 1024;
/** 업로드 칸 아래 안내 문구 */
export const COURSE_FILE_HINT = "PDF·오피스·한글·이미지·ZIP·텍스트 · 20MB 이하";

type Sig = "pdf" | "zip" | "ole" | "image" | "text";
const TEXT = "text/plain; charset=utf-8";
/** 허용 확장자 → 전달 MIME·시그니처 종류 */
const COURSE_TYPES: Record<string, { mime: string; sig: Sig }> = {
  pdf: { mime: "application/pdf", sig: "pdf" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", sig: "zip" },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", sig: "zip" },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", sig: "zip" },
  hwpx: { mime: "application/octet-stream", sig: "zip" },
  zip: { mime: "application/zip", sig: "zip" },
  hwp: { mime: "application/x-hwp", sig: "ole" },
  doc: { mime: "application/msword", sig: "ole" },
  ppt: { mime: "application/vnd.ms-powerpoint", sig: "ole" },
  xls: { mime: "application/vnd.ms-excel", sig: "ole" },
  png: { mime: "image/png", sig: "image" },
  jpg: { mime: "image/jpeg", sig: "image" },
  jpeg: { mime: "image/jpeg", sig: "image" },
  webp: { mime: "image/webp", sig: "image" },
  txt: { mime: TEXT, sig: "text" },
  md: { mime: TEXT, sig: "text" },
  csv: { mime: TEXT, sig: "text" },
  json: { mime: TEXT, sig: "text" },
  ipynb: { mime: TEXT, sig: "text" },
  py: { mime: TEXT, sig: "text" },
  java: { mime: TEXT, sig: "text" },
  js: { mime: TEXT, sig: "text" },
  ts: { mime: TEXT, sig: "text" },
  sql: { mime: TEXT, sig: "text" },
};
/** <input accept>용 */
export const COURSE_FILE_ACCEPT = Object.keys(COURSE_TYPES)
  .map((e) => `.${e}`)
  .join(",");

// 화면에서도 COURSE_FILE_ACCEPT를 가져가므로 모듈 최상위에서 Buffer를 만들지 않는다.
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

function sigMatches(sig: Sig, head: Buffer, ext: string): boolean {
  switch (sig) {
    case "pdf":
      return head.subarray(0, 5).toString("latin1") === "%PDF-";
    case "zip":
      return head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
    case "ole":
      return head.length >= 8 && OLE.every((b, i) => head[i] === b);
    case "image":
      return detectImage(head) === (ext === "jpeg" ? "jpg" : ext);
    case "text":
      return !head.subarray(0, 8192).includes(0);
  }
}

/** 자료·제출 파일 검사. 통과하면 저장 확장자와 전달 MIME, 아니면 오류 문구. */
export function checkCourseFile(file: { name: string; size: number }, head: Buffer): { ext: string; mime: string } | string {
  if (file.size <= 0) return "빈 파일입니다.";
  if (file.size > COURSE_FILE_MAX_BYTES) return "파일은 20MB 이하만 올릴 수 있습니다.";
  const ext = file.name.includes(".") ? (file.name.split(".").pop()?.toLowerCase() ?? "") : "";
  const t = COURSE_TYPES[ext];
  if (!t) return "올릴 수 없는 파일 형식입니다. (PDF·오피스·한글·이미지·ZIP·텍스트)";
  if (!sigMatches(t.sig, head, ext)) return "파일 내용이 확장자와 맞지 않습니다.";
  return { ext: ext === "jpeg" ? "jpg" : ext, mime: t.mime };
}

/** 브라우저에서 바로 열어도 되는 MIME (그 외는 내려받기) */
export function isInlineMime(mime: string): boolean {
  return mime === "application/pdf" || mime.startsWith("image/");
}

/** 내려받을 파일명 정리: 경로 구분자·제어문자 제거, 255자 제한 */
export function safeFileName(name: string): string {
  const cleaned = name.replace(/[\\/\u0000-\u001f\u007f]/g, "_").trim();
  return (cleaned || "file").slice(0, 255);
}
