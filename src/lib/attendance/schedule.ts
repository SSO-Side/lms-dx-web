// 반 개설·설정 시 훈련일과 단위기간을 만드는 순수 함수. DB·Next 의존 금지.
import { addDaysYmd, addMonthsYmd, dowOfYmd } from "@/lib/dates";

/** { "1": ["09:00","17:40"], ... } (1=월 ~ 5=금, 0=일, 6=토) */
export type WeeklySchedule = Record<string, [string, string]>;

/** 기본 훈련 요일(월~금) */
export const DEFAULT_WEEKLY_SCHEDULE: WeeklySchedule = {
  "1": ["09:00", "17:40"],
  "2": ["09:00", "17:40"],
  "3": ["09:00", "17:40"],
  "4": ["09:00", "17:40"],
  "5": ["09:00", "16:40"],
};

export type TrainingDayDraft = { date: string; isTraining: boolean; note?: string };

/** 수업 요일에 해당하는 날을 만든다. 휴강일은 isTraining=false 로 남긴다. */
export function generateTrainingDays(
  start: string,
  end: string,
  schedule: WeeklySchedule,
  holidays: string[]
): TrainingDayDraft[] {
  const off = new Set(holidays);
  const days: TrainingDayDraft[] = [];
  for (let d = start; d <= end; d = addDaysYmd(d, 1)) {
    if (!schedule[String(dowOfYmd(d))]) continue;
    days.push(off.has(d) ? { date: d, isTraining: false, note: "휴강" } : { date: d, isTraining: true });
  }
  return days;
}

export type PeriodDraft = { label: string; startDate: string; endDate: string };

/** 시작일 기준 1개월 단위 단위기간. 마지막은 종료일까지. */
export function generateMonthlyPeriods(start: string, end: string): PeriodDraft[] {
  const periods: PeriodDraft[] = [];
  for (let i = 0; ; i++) {
    const s = addMonthsYmd(start, i);
    if (s > end) break;
    const next = addMonthsYmd(start, i + 1);
    const e = next > end ? end : addDaysYmd(next, -1);
    periods.push({ label: `${i + 1}단위기간`, startDate: s, endDate: e });
    if (e >= end) break;
  }
  return periods;
}

/** 날짜가 속한 단위기간. 없으면 undefined. */
export function findPeriod<T extends { startDate: string; endDate: string }>(periods: T[], ymd: string): T | undefined {
  return periods.find((p) => p.startDate <= ymd && ymd <= p.endDate);
}
