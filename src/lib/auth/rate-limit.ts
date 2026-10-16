interface AttemptRecord {
  count: number;
  resetAt: number;
}

// 메모리 기반 (프로세스 재시작 시 초기화, 다중 프로세스면 프로세스별로 따로 센다)
const attempts = new Map<string, AttemptRecord>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15분

/** 기본값은 로그인 실패 제한(15분 5회). 다른 용도는 키 접두어와 함께 횟수·기간을 넘긴다. */
export type RateLimitOptions = { max?: number; windowMs?: number };

export function checkRateLimit(key: string, opts: RateLimitOptions = {}): boolean {
  const now = Date.now();
  const record = attempts.get(key);

  if (!record || now > record.resetAt) {
    return true; // 허용
  }

  return record.count < (opts.max ?? MAX_ATTEMPTS);
}

export function recordFailedAttempt(key: string, opts: RateLimitOptions = {}): void {
  const now = Date.now();
  const record = attempts.get(key);

  if (!record || now > record.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + (opts.windowMs ?? WINDOW_MS) });
  } else {
    record.count += 1;
  }
}

export function resetRateLimit(key: string): void {
  attempts.delete(key);
}
