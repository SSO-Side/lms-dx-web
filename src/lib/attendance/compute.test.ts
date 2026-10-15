import { describe, it, expect } from "vitest";
import { computeAttendance, withDefaults, type Ev, type EvType, type Opening, type AttendanceConfig } from "./compute";

// docs/spec/attendance.md §4 표를 그대로 옮긴 표 기반 테스트
const evs = (type: EvType, count: number, excused = false): Ev[] =>
  Array.from({ length: count }, (_, i) => ({ date: `2026-10-${String(i + 11).padStart(2, "0")}`, type, excused }));

type Row = {
  no: number;
  n: number;
  events: Ev[];
  opening?: Opening;
  config?: Parameters<typeof withDefaults>[0];
  expect: [allowed: number, converted: number, excusedUsed: number, overflow: number, remaining: number, grade: string];
};

const ROWS: Row[] = [
  { no: 1, n: 20, events: [], expect: [4, 0, 0, 0, 4, "NORMAL"] },
  { no: 2, n: 22, events: [], expect: [4, 0, 0, 0, 4, "NORMAL"] },
  { no: 3, n: 19, events: [], expect: [3, 0, 0, 0, 3, "NORMAL"] },
  { no: 4, n: 20, events: evs("ABSENT", 2), expect: [4, 2, 0, 0, 2, "NORMAL"] },
  { no: 5, n: 20, events: evs("ABSENT", 3), expect: [4, 3, 0, 0, 1, "WARN"] },
  { no: 6, n: 20, events: evs("ABSENT", 4), expect: [4, 4, 0, 0, 0, "DANGER"] },
  { no: 7, n: 20, events: evs("ABSENT", 5), expect: [4, 5, 0, 0, -1, "DANGER"] },
  { no: 8, n: 20, events: [...evs("LATE", 2), ...evs("EARLY_LEAVE", 1)], expect: [4, 1, 0, 0, 3, "NORMAL"] },
  { no: 9, n: 20, events: evs("LATE", 2), expect: [4, 0, 0, 0, 4, "NORMAL"] },
  { no: 10, n: 20, events: [...evs("LATE", 2), ...evs("EARLY_LEAVE", 2)], config: { combineLateEarly: true }, expect: [4, 1, 0, 0, 3, "NORMAL"] },
  { no: 11, n: 20, events: [...evs("LATE", 2), ...evs("EARLY_LEAVE", 2)], config: { combineLateEarly: false }, expect: [4, 0, 0, 0, 4, "NORMAL"] },
  { no: 12, n: 20, events: evs("ABSENT", 3, true), config: { excused: { limit: null } }, expect: [4, 0, 3, 0, 4, "NORMAL"] },
  { no: 13, n: 20, events: evs("ABSENT", 3, true), config: { excused: { limit: 2 } }, expect: [4, 1, 3, 1, 3, "NORMAL"] },
  { no: 14, n: 20, events: evs("LATE", 5), expect: [4, 1, 0, 0, 3, "NORMAL"] },
  { no: 15, n: 20, events: evs("LATE", 1, true), expect: [4, 0, 0, 0, 4, "NORMAL"] },
  { no: 16, n: 0, events: [], expect: [0, 0, 0, 0, 0, "NA"] },
  {
    no: 17,
    n: 20,
    opening: { absent: 1, late: 2, earlyLeave: 0, out: 0, excusedUsed: 1, asOfDate: "2026-10-10" },
    events: [
      { date: "2026-10-09", type: "LATE", excused: false },
      { date: "2026-10-12", type: "LATE", excused: false },
    ],
    expect: [4, 2, 1, 0, 2, "NORMAL"],
  },
];

describe("computeAttendance (attendance.md §4)", () => {
  it.each(ROWS)("#$no", (row) => {
    const config: AttendanceConfig = withDefaults(row.config);
    const r = computeAttendance({ trainingDays: row.n, events: row.events, opening: row.opening, config });
    expect([r.allowedAbsences, r.convertedAbsences, r.excusedUsed, r.excusedOverflow, r.remaining, r.grade]).toEqual(row.expect);
  });
});
