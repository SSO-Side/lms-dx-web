// 로컬 디스크 드라이버. Docker에서는 STORAGE_DIR를 볼륨(예: /data/storage)으로 마운트해 컨테이너를 바꿔도 파일이 남게 한다.
import path from "path";
import { promises as fs } from "fs";
import { assertValidKey, type StorageDriver } from "./types";

export function createLocalDriver(rootDir: string): StorageDriver {
  const root = path.resolve(process.cwd(), rootDir);
  const resolve = (key: string) => {
    assertValidKey(key);
    const full = path.resolve(root, key);
    if (!full.startsWith(root + path.sep)) throw new Error("잘못된 저장 경로");
    return full;
  };
  return {
    name: "local",
    async put(key, data) {
      const full = resolve(key);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, data);
    },
    async get(key) {
      return fs.readFile(resolve(key));
    },
    async delete(key) {
      await fs.unlink(resolve(key)).catch(() => {});
    },
  };
}
