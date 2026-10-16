// 저장소 드라이버 계약. 저장 키는 "접두어/난수.확장자" 형태의 상대 키로, 드라이버와 무관하게 DB에 그대로 저장한다.
// 드라이버를 바꿔도(로컬 디스크 → S3 호환 오브젝트 저장소 등) 키와 호출부는 바뀌지 않는다.

export interface StorageDriver {
  /** 드라이버 이름 (local, s3 …) */
  readonly name: string;
  put(key: string, data: Buffer, contentType?: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  /** 없으면 조용히 무시 */
  delete(key: string): Promise<void>;
}

/** 키 형식 검사: 영숫자·-·_·. 와 / 만, ".." 구간 금지, 절대 경로 금지 */
export function assertValidKey(key: string): void {
  if (!/^[A-Za-z0-9_\-.]+(\/[A-Za-z0-9_\-.]+)*$/.test(key) || key.split("/").some((p) => p === ".." || p === ".")) {
    throw new Error("잘못된 저장 키");
  }
}
