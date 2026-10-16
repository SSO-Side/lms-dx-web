// 파일 저장소 추상화. 호출부는 saveFile/readFile/deleteFile과 저장 키만 쓴다. 직접 URL을 만들지 않고, 권한 확인 후 서버가 전달한다(serve.ts).
// 드라이버는 STORAGE_DRIVER로 고른다. 지금은 local(STORAGE_DIR)만 있고, 오브젝트 저장소로 옮길 때는 types.ts 계약대로 드라이버만 추가한다.
import crypto from "crypto";
import path from "path";
import { createLocalDriver } from "./local";
import type { StorageDriver } from "./types";

export * from "./validators";
export type { StorageDriver } from "./types";

let driver: StorageDriver | null = null;

export function getStorage(): StorageDriver {
  if (driver) return driver;
  const kind = process.env.STORAGE_DRIVER || "local";
  if (kind !== "local") throw new Error(`지원하지 않는 STORAGE_DRIVER: ${kind}`);
  driver = createLocalDriver(process.env.STORAGE_DIR || ".storage");
  return driver;
}

/** 저장 후 저장 키("접두어/난수.확장자")를 돌려준다. */
export async function saveFile(prefix: string, data: Buffer, ext: string, contentType?: string): Promise<string> {
  const key = path.posix.join(prefix, `${crypto.randomUUID()}.${ext}`);
  await getStorage().put(key, data, contentType);
  return key;
}

export async function readFile(key: string): Promise<Buffer> {
  return getStorage().get(key);
}

export async function deleteFile(key: string): Promise<void> {
  await getStorage().delete(key);
}
