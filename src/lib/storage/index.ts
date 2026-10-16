// 파일 저장소 추상화. 지금은 로컬 디스크(STORAGE_DIR). 직접 URL을 만들지 않고, 권한 확인 후 서버가 읽어 전달한다.
import crypto from "crypto";
import path from "path";
import { promises as fs } from "fs";

const ROOT = path.resolve(process.cwd(), process.env.STORAGE_DIR || ".storage");

export const PROOF_MAX_BYTES = 10 * 1024 * 1024;
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

function safeResolve(relPath: string): string {
  const full = path.resolve(ROOT, relPath);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("잘못된 저장 경로");
  return full;
}

/** 저장 후 STORAGE_DIR 기준 상대 경로를 돌려준다. */
export async function saveFile(prefix: string, data: Buffer, ext: string): Promise<string> {
  const rel = path.posix.join(prefix, `${crypto.randomUUID()}.${ext}`);
  const full = safeResolve(rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
  return rel;
}

export async function readFile(relPath: string): Promise<Buffer> {
  return fs.readFile(safeResolve(relPath));
}

export async function deleteFile(relPath: string): Promise<void> {
  await fs.unlink(safeResolve(relPath)).catch(() => {});
}
