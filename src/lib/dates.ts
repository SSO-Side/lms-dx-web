// 날짜는 YYYY-MM-DD 문자열(Asia/Seoul 기준)로 다룬다. @db.Date 값은 UTC 자정으로 저장된다.

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function isYmd(s: unknown): s is string {
  if (typeof s !== "string" || !YMD.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** 오늘 날짜 (Asia/Seoul). */
export function todayYmd(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
}

/** @db.Date 컬럼에 저장·조회할 Date (UTC 자정). */
export function ymdToDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00Z`);
}

/** @db.Date 값을 YYYY-MM-DD 로. */
export function dateToYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDaysYmd(ymd: string, n: number): string {
  const d = ymdToDate(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return dateToYmd(d);
}

/** 0=일 ~ 6=토 */
export function dowOfYmd(ymd: string): number {
  return ymdToDate(ymd).getUTCDay();
}

/** 같은 일(day)로 n개월 뒤. 말일을 넘으면 그 달 말일로 맞춘다. */
export function addMonthsYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return dateToYmd(target);
}

/** 화면 표시용: 2026-10-15 (목) */
export function formatYmdWithDow(ymd: string): string {
  return `${ymd} (${"일월화수목금토"[dowOfYmd(ymd)]})`;
}

/** 일시를 Asia/Seoul 기준 "YYYY-MM-DD HH:mm" 으로. */
export function formatDateTime(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`;
}
