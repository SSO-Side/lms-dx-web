# 출결 계산 명세 (M3)

구현 위치: `src/lib/attendance/compute.ts` (순수 함수, DB·Next 의존 금지)
테스트: `src/lib/attendance/compute.test.ts` — 아래 표를 그대로 옮긴 **표 기반 테스트 1개 파일**
`[TBD]` 값은 설정값으로만 두고 기본값으로 동작시킨다. 구현하지 말고 학원 답을 기다린다.

## 1. Config (`Cohort.attendanceConfig`)

```ts
type AttendanceConfig = {
  requiredPercent: number;        // 기본 80 (단위기간 출석률 요건)
  lateEarlyToAbsent: number;      // 기본 3  (지각·조퇴 k회 = 결석 1일)
  combineLateEarly: boolean;      // 기본 true [TBD] true: 지각+조퇴를 합산해 k로 나눔 / false: 각각 따로
  outCounts: "IGNORE";            // 기본 IGNORE [TBD] 외출은 계산에서 제외
  excused: {                      // 병결·휴가: 출석으로 처리하되 횟수 제한 [TBD]
    limit: number | null;         //   null = 제한 없음 (기본)
    scope: "PERIOD" | "COURSE";   //   기본 PERIOD. COURSE는 구현하지 않고 설정값 자리만 둔다
    overflow: "COUNT_AS_ABSENT";  //   제한 초과분은 결석으로 계산 (기본)
  };
  grade: { normalMinRemaining: number; warnMinRemaining: number }; // 기본 2, 1 [TBD]
};
```
설정이 비어 있으면 위 기본값으로 채운다 (`withDefaults(config)`).

## 2. 함수 시그니처

```ts
type Ev = { date: string; type: "ABSENT" | "LATE" | "EARLY_LEAVE" | "OUT"; excused: boolean };
type Opening = { absent: number; late: number; earlyLeave: number; out: number; excusedUsed: number; asOfDate: string };

computeAttendance(input: {
  trainingDays: number;        // N (단위기간 내 훈련일수)
  events: Ev[];                // 해당 학생·단위기간의 이벤트 (호출 측이 기간 필터링)
  opening?: Opening;
  config: AttendanceConfig;
}): {
  allowedAbsences: number;     // floor(N × (100 − requiredPercent) / 100)  ← 정수 연산
  convertedAbsences: number;
  excusedUsed: number;
  excusedOverflow: number;
  remaining: number;           // allowedAbsences − convertedAbsences (음수 가능)
  grade: "NORMAL" | "WARN" | "DANGER" | "NA";
}
```

## 3. 규칙
1. `allowedAbsences = floor(N × (100 − requiredPercent) / 100)` — 부동소수점(`N * 0.2`) 금지.
2. `opening`이 있으면 `asOfDate` **이하** 날짜의 `events`는 무시한다 (이중 집계 방지). 이후 이벤트만 더한다.
3. 결석 집계: `excused=false`인 ABSENT는 `absent`에, `excused=true`인 ABSENT는 `excusedUsed`에 더한다. opening의 `absent`는 공결 제외 결석, `excusedUsed`는 병결·휴가 사용 횟수다.
4. `excused.limit`이 숫자이면 `excusedOverflow = max(0, excusedUsed − limit)`이고 초과분은 결석으로 환산한다. `null`이면 초과 없음.
5. LATE·EARLY_LEAVE는 `excused=false`만 센다 (공결 표시된 지각·조퇴는 무시). OUT은 `outCounts=IGNORE`이므로 계산하지 않는다.
6. 지각·조퇴 환산: `combineLateEarly=true`면 `floor((late + early) / k)`, `false`면 `floor(late / k) + floor(early / k)`.
7. `convertedAbsences = absent + excusedOverflow + (지각·조퇴 환산)`.
8. 등급: `N = 0`이면 `NA`. 그 외 `remaining ≥ normalMinRemaining` → NORMAL, `≥ warnMinRemaining` → WARN, 그 이하 → DANGER.
9. 훈련일수 `N`은 `TrainingDay`에서 `isTraining=true`인 날을 단위기간으로 세어 구한다 (별도 함수 `countTrainingDays`).

## 4. 표 기반 테스트 케이스 (기본 설정, 지정한 항목만 다름)

| # | N | 입력 | 설정 변경 | allowed | converted | excusedUsed | overflow | remaining | grade |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| 1 | 20 | 이벤트 없음 | — | 4 | 0 | 0 | 0 | 4 | NORMAL |
| 2 | 22 | 이벤트 없음 (22×20/100=4.4 → 4) | — | 4 | 0 | 0 | 0 | 4 | NORMAL |
| 3 | 19 | 이벤트 없음 (3.8 → 3) | — | 3 | 0 | 0 | 0 | 3 | NORMAL |
| 4 | 20 | 결석 2 | — | 4 | 2 | 0 | 0 | 2 | NORMAL |
| 5 | 20 | 결석 3 | — | 4 | 3 | 0 | 0 | 1 | WARN |
| 6 | 20 | 결석 4 | — | 4 | 4 | 0 | 0 | 0 | DANGER |
| 7 | 20 | 결석 5 | — | 4 | 5 | 0 | 0 | −1 | DANGER |
| 8 | 20 | 지각 2 + 조퇴 1 (합산 3) | — | 4 | 1 | 0 | 0 | 3 | NORMAL |
| 9 | 20 | 지각 2 | — | 4 | 0 | 0 | 0 | 4 | NORMAL |
| 10 | 20 | 지각 2 + 조퇴 2 | combine=true | 4 | 1 | 0 | 0 | 3 | NORMAL |
| 11 | 20 | 지각 2 + 조퇴 2 | combine=false | 4 | 0 | 0 | 0 | 4 | NORMAL |
| 12 | 20 | 병결 결석(excused) 3 | limit=null | 4 | 0 | 3 | 0 | 4 | NORMAL |
| 13 | 20 | 병결 결석(excused) 3 | limit=2 | 4 | 1 | 3 | 1 | 3 | NORMAL |
| 14 | 20 | 지각 5 | — | 4 | 1 | 0 | 0 | 3 | NORMAL |
| 15 | 20 | 공결 표시된 지각 1 (무시) | — | 4 | 0 | 0 | 0 | 4 | NORMAL |
| 16 | 0 | 이벤트 없음 | — | 0 | 0 | 0 | 0 | 0 | NA |
| 17 | 20 | opening{결석1, 지각2, 공결사용1, asOf 10-10} + 이벤트: 10-09 지각(무시), 10-12 지각 | — | 4 | 2 | 1 | 0 | 2 | NORMAL |

17번 해설: 지각 = 2 + 1 = 3 → 환산 1, 결석 1 → converted 2. 10-09 이벤트는 asOf 이전이라 무시.
위 값은 별도 스크립트로 계산해 검증했다. 구현이 이 표와 다르면 구현이 틀린 것이다.

## 5. 테스트 방침
- 표의 17행만 테스트한다. 추가 케이스를 임의로 늘리지 않는다 (경계가 더 필요하면 먼저 묻는다).
- 학원 수기 계산과 대조한 샘플이 생기면 같은 표 형식으로 행만 추가한다.

## 6. 이 함수 밖의 규칙 (서버 액션에서 처리, 별도 테스트 불필요)
- 이벤트는 `(cohortId, studentId, date, type)`이 유일하다. 같은 키를 다시 기록하면 수정으로 처리하고 `AttendanceEventLog`에 남긴다.
- 훈련일이 아닌 날짜(`isTraining=false` 또는 `TrainingDay` 없음)에는 이벤트를 만들 수 없다.
- 결석계(ABSENCE 티켓)가 APPROVED가 되면 `AbsenceDetail.absentDate`에 `ABSENT(excused=true, excusedType=SICK|LEAVE)` 이벤트를 만들고 `ticketId`로 연결한다. 사유가 OTHER이면 공결로 처리하지 않는다.
- 출결 입력·수정은 MANAGER와 ACADEMY_ADMIN만 가능하며 INSTRUCTOR는 열람 전용이다.
- 화면에는 항상 "참고용"과 **최종 반영일**(`AttendanceDayClose` 중 가장 늦은 날짜)을 표시하고, 단위기간 내 훈련일 중 확인되지 않은 날이 있으면 경고한다.
