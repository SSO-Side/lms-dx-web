// 출결 계산 순수 함수 (docs/spec/attendance.md). DB·Next 의존 금지.

export type AttendanceConfig = {
  requiredPercent: number;
  lateEarlyToAbsent: number;
  combineLateEarly: boolean;
  outCounts: "IGNORE";
  excused: {
    limit: number | null;
    scope: "PERIOD" | "COURSE";
    overflow: "COUNT_AS_ABSENT";
  };
  grade: { normalMinRemaining: number; warnMinRemaining: number };
};

export type EvType = "ABSENT" | "LATE" | "EARLY_LEAVE" | "OUT";
export type Ev = { date: string; type: EvType; excused: boolean };
export type Opening = {
  absent: number;
  late: number;
  earlyLeave: number;
  out: number;
  excusedUsed: number;
  asOfDate: string;
};
export type Grade = "NORMAL" | "WARN" | "DANGER" | "NA";

export type AttendanceResult = {
  allowedAbsences: number;
  convertedAbsences: number;
  excusedUsed: number;
  excusedOverflow: number;
  remaining: number;
  grade: Grade;
  /** 화면 표시용 원시 누계 (opening 포함) */
  counts: { absent: number; late: number; earlyLeave: number; out: number };
};

/** 반 개설 때 넣는 출결 규칙 기본값. 실제 계산은 반마다 저장된 attendanceConfig를 쓴다. */
export const DEFAULT_ATTENDANCE_CONFIG: AttendanceConfig = {
  requiredPercent: 80,
  lateEarlyToAbsent: 3,
  combineLateEarly: true,
  outCounts: "IGNORE",
  excused: { limit: null, scope: "PERIOD", overflow: "COUNT_AS_ABSENT" },
  grade: { normalMinRemaining: 2, warnMinRemaining: 1 },
};

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** 비어 있거나 일부만 있는 설정(Json)을 기본값으로 채운다. */
export function withDefaults(config?: DeepPartial<AttendanceConfig> | null): AttendanceConfig {
  const c = (config ?? {}) as DeepPartial<AttendanceConfig>;
  const d = DEFAULT_ATTENDANCE_CONFIG;
  return {
    requiredPercent: c.requiredPercent ?? d.requiredPercent,
    lateEarlyToAbsent: c.lateEarlyToAbsent ?? d.lateEarlyToAbsent,
    combineLateEarly: c.combineLateEarly ?? d.combineLateEarly,
    outCounts: "IGNORE",
    excused: {
      limit: c.excused?.limit === undefined ? d.excused.limit : c.excused.limit,
      scope: c.excused?.scope ?? d.excused.scope,
      overflow: "COUNT_AS_ABSENT",
    },
    grade: {
      normalMinRemaining: c.grade?.normalMinRemaining ?? d.grade.normalMinRemaining,
      warnMinRemaining: c.grade?.warnMinRemaining ?? d.grade.warnMinRemaining,
    },
  };
}

/** 출결 이벤트 목록으로 누계(출석률·환산 결석·남은 일수·등급)를 계산한다. 저장하지 않고 매번 계산한다. */
export function computeAttendance(input: {
  trainingDays: number;
  events: Ev[];
  opening?: Opening;
  config: AttendanceConfig;
}): AttendanceResult {
  const { trainingDays: n, events, opening, config } = input;

  let absent = opening?.absent ?? 0;
  let late = opening?.late ?? 0;
  let earlyLeave = opening?.earlyLeave ?? 0;
  let out = opening?.out ?? 0;
  let excusedUsed = opening?.excusedUsed ?? 0;

  for (const ev of events) {
    if (opening && ev.date <= opening.asOfDate) continue;
    switch (ev.type) {
      case "ABSENT":
        if (ev.excused) excusedUsed++;
        else absent++;
        break;
      case "LATE":
        if (!ev.excused) late++;
        break;
      case "EARLY_LEAVE":
        if (!ev.excused) earlyLeave++;
        break;
      case "OUT":
        out++;
        break;
    }
  }

  const allowedAbsences = Math.floor((n * (100 - config.requiredPercent)) / 100);
  const excusedOverflow = config.excused.limit === null ? 0 : Math.max(0, excusedUsed - config.excused.limit);
  const k = config.lateEarlyToAbsent;
  const lateEarlyConverted = config.combineLateEarly
    ? Math.floor((late + earlyLeave) / k)
    : Math.floor(late / k) + Math.floor(earlyLeave / k);

  const convertedAbsences = absent + excusedOverflow + lateEarlyConverted;
  const remaining = allowedAbsences - convertedAbsences;

  let grade: Grade;
  if (n === 0) grade = "NA";
  else if (remaining >= config.grade.normalMinRemaining) grade = "NORMAL";
  else if (remaining >= config.grade.warnMinRemaining) grade = "WARN";
  else grade = "DANGER";

  return {
    allowedAbsences,
    convertedAbsences,
    excusedUsed,
    excusedOverflow,
    remaining,
    grade,
    counts: { absent, late, earlyLeave, out },
  };
}

/** 단위기간 [start, end] 안의 훈련일(isTraining=true) 수. 날짜는 YYYY-MM-DD 문자열. */
export function countTrainingDays(
  days: { date: string; isTraining: boolean }[],
  start: string,
  end: string
): number {
  return days.filter((d) => d.isTraining && d.date >= start && d.date <= end).length;
}
