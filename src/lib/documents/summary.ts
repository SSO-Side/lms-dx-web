// 서류 현황 집계 (순수 함수). 수강생 한 명의 대표 단계 = 가진 서류 중 가장 덜 진행된 상태.
import type { DocumentStatus } from "@prisma/client";

export type StudentStage = DocumentStatus | "NONE";

const ORDER: Record<DocumentStatus, number> = { DRAFT: 0, IN_REVIEW: 1, DONE: 2 };

export function studentStage(statuses: DocumentStatus[]): StudentStage {
  if (statuses.length === 0) return "NONE";
  return statuses.reduce((min, s) => (ORDER[s] < ORDER[min] ? s : min));
}

export type StageCounts = Record<StudentStage, number>;

export function countStages(stages: StudentStage[]): StageCounts {
  const c: StageCounts = { NONE: 0, DRAFT: 0, IN_REVIEW: 0, DONE: 0 };
  for (const s of stages) c[s] += 1;
  return c;
}
