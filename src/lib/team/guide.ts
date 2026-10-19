// M5 팀 프로젝트 단계 가이드 (PRD M5 표 그대로). 단계·체크포인트 키의 단일 기준.
// 순수 함수만 둔다. 날짜는 YYYY-MM-DD 문자열(Asia/Seoul)로 다룬다.

import { addDaysYmd, ymdToDate } from "@/lib/dates";

export type StageNo = 1 | 2 | 3 | 4;

export type Checkpoint = { key: string; label: string };

export type StageGuide = {
  stage: StageNo;
  name: string;
  period: string;
  goal: string;
  /** 반 기간 대비 목표 완료 시점(비율). 4단계는 종료일. */
  targetRatio: number;
  checkpoints: Checkpoint[];
};

/** 팀 프로젝트 단계별 가이드(목표·체크리스트·산출물) */
export const STAGES: StageGuide[] = [
  {
    stage: 1,
    name: "착수",
    period: "초반 (~25%)",
    goal: "주제·범위 정의",
    targetRatio: 0.25,
    checkpoints: [
      { key: "s1_problem", label: "문제 정의 1문장" },
      { key: "s1_features", label: "핵심 기능 3개 이내" },
      { key: "s1_stack", label: "스택 선택 이유" },
      { key: "s1_repo", label: "저장소 생성" },
    ],
  },
  {
    stage: 2,
    name: "MVP",
    period: "중반 (~60%)",
    goal: "동작하는 최소 버전 + 배포",
    targetRatio: 0.6,
    checkpoints: [
      { key: "s2_core", label: "핵심 기능 동작" },
      { key: "s2_deploy", label: "배포 URL" },
      { key: "s2_readme", label: "README 초안" },
    ],
  },
  {
    stage: 3,
    name: "고도화",
    period: "후반 (~85%)",
    goal: "품질·검증·기록",
    targetRatio: 0.85,
    checkpoints: [
      { key: "s3_metric", label: "검증 수치 1개 이상" },
      { key: "s3_trouble", label: "트러블슈팅 2건 이상" },
    ],
  },
  {
    stage: 4,
    name: "서류 반영",
    period: "마무리",
    goal: "이력서·쇼케이스 정리",
    targetRatio: 1,
    checkpoints: [
      { key: "s4_resume", label: "프로젝트 기록 → 이력서 반영" },
      { key: "s4_showcase", label: "쇼케이스 원고" },
    ],
  },
];

/** 프로젝트 완료 체크리스트 (ProjectMilestone.stage = 0으로 저장) */
export const COMPLETION_CHECKLIST: Checkpoint[] = [
  { key: "c_explain", label: "무엇을·왜 만들었는지 한 문단으로 설명할 수 있다" },
  { key: "c_roles", label: "개인별 역할과 기여가 구분되어 기록되어 있다" },
  { key: "c_demo", label: "배포된 URL 또는 실행 가능한 데모가 있다" },
  { key: "c_readme", label: "README에 실행 방법·기술 스택·주요 기능이 있다" },
  { key: "c_metric", label: "검증 수치 1개 이상 (응답 시간, 테스트 통과율, 정확도 등)" },
  { key: "c_trouble", label: "트러블슈팅 기록 2건 이상 (원인 → 해결 → 결과)" },
];

/** 완료 체크리스트를 뜻하는 단계 번호(0) */
export const COMPLETION_STAGE = 0;

/** 올바른 단계 번호인지 */
export function isStageNo(n: unknown): n is StageNo {
  return n === 1 || n === 2 || n === 3 || n === 4;
}

/** 단계 번호로 가이드 찾기 */
export function stageGuide(stage: number): StageGuide {
  return STAGES.find((s) => s.stage === stage) ?? STAGES[0];
}

/** 체크 키가 속한 단계 (0 = 완료 체크리스트). 모르는 키는 null. */
export function stageOfCheckKey(key: string): number | null {
  if (COMPLETION_CHECKLIST.some((c) => c.key === key)) return COMPLETION_STAGE;
  return STAGES.find((s) => s.checkpoints.some((c) => c.key === key))?.stage ?? null;
}

function daysBetween(a: string, b: string): number {
  return Math.round((ymdToDate(b).getTime() - ymdToDate(a).getTime()) / 86_400_000);
}

/** 반 시작·종료일로 단계별 목표 완료일 (25% / 60% / 85% / 종료일) */
export function stageTargetDates(startYmd: string, endYmd: string): Record<StageNo, string> {
  const total = Math.max(0, daysBetween(startYmd, endYmd));
  const at = (ratio: number) => (ratio >= 1 ? endYmd : addDaysYmd(startYmd, Math.round(total * ratio)));
  return { 1: at(0.25), 2: at(0.6), 3: at(0.85), 4: endYmd };
}

/** 오늘 기준으로 팀이 진행 중이어야 할 단계: 목표일을 지난 단계 수 + 1 (최대 4) */
export function expectedStage(startYmd: string, endYmd: string, todayYmd: string): StageNo {
  const targets = stageTargetDates(startYmd, endYmd);
  let passed = 0;
  for (const s of [1, 2, 3] as const) if (todayYmd > targets[s]) passed = s;
  return (passed + 1) as StageNo;
}

/** 팀 단계가 목표 단계보다 늦은지 */
export function isBehind(stage: number, startYmd: string, endYmd: string, todayYmd: string): boolean {
  return stage < expectedStage(startYmd, endYmd, todayYmd);
}

/** 그 주 월요일 (개인 주간 로그의 weekOf) */
export function weekOfYmd(ymd: string): string {
  const dow = ymdToDate(ymd).getUTCDay(); // 0=일
  return addDaysYmd(ymd, dow === 0 ? -6 : 1 - dow);
}

/** 체크 진행률 (0~100) */
export function progressPercent(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

/** 완료 체크리스트 완료 수 */
export function completionDone(checks: Record<string, { done: boolean }>): number {
  return COMPLETION_CHECKLIST.filter((c) => checks[c.key]?.done).length;
}

/** 단계 체크포인트 완료 수 */
export function stageDone(stage: number, checks: Record<string, { done: boolean }>): number {
  return stageGuide(stage).checkpoints.filter((c) => checks[c.key]?.done).length;
}
