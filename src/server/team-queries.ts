// 팀 프로젝트(M5) 조회 함수: 팀 목록·상세, 내 팀, 단계 요약.
import { EnrollmentStatus, Role, type TeamStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { dateToYmd, formatDateTime } from "@/lib/dates";
import { STAGES, expectedStage, stageTargetDates, type StageNo } from "@/lib/team/guide";

// 호출 측이 먼저 requireCohortAccess로 권한을 확인하고 ctx.cohortId만 넘긴다.

export type ProjectPlan = { problem: string; features: string[]; roles: Array<{ name: string; part: string }> };

export type TeamMemberRow = { userId: number; name: string; loginId: string; role: string | null; isLeader: boolean };
export type CheckState = { done: boolean; doneAt: string | null };
export type FeedbackRow = { id: number; instructorName: string; stage: number; comment: string; createdAt: string };
export type LogRow = {
  id: number;
  userId: number;
  userName: string;
  weekOf: string;
  progress: string;
  blocker: string | null;
  resolution: string | null;
  metric: string | null;
  updatedAt: string;
};

export type TeamSchedule = { targets: Record<StageNo, string>; expected: StageNo; today: string };

export type TeamDetail = {
  id: number;
  name: string;
  status: TeamStatus;
  leaderId: number;
  members: TeamMemberRow[];
  project: {
    id: number;
    title: string;
    summary: string | null;
    plan: ProjectPlan;
    repoUrl: string | null;
    deployUrl: string | null;
    techStack: string[];
    stage: StageNo;
    stageUpdatedAt: string | null;
  };
  checks: Record<string, CheckState>;
  feedbacks: FeedbackRow[];
  logs: LogRow[];
  behind: boolean;
  schedule: TeamSchedule;
};

export type TeamRow = {
  id: number;
  name: string;
  projectTitle: string;
  leaderName: string;
  memberCount: number;
  stage: StageNo;
  /** 이번 단계 체크포인트 진행 (완료/전체) */
  stageDone: number;
  stageTotal: number;
  behind: boolean;
  lastLogAt: string | null;
};

function toStage(n: number): StageNo {
  return (n >= 1 && n <= 4 ? n : 1) as StageNo;
}

function strings(v: unknown, max = 20): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, max) : [];
}

/** DB의 기획안(JSON)을 안전하게 객체로 바꾼다. */
export function parsePlan(v: unknown): ProjectPlan {
  const o = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const roles = Array.isArray(o.roles)
    ? o.roles
        .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
        .map((r) => ({ name: String(r.name ?? ""), part: String(r.part ?? "") }))
        .slice(0, 10)
    : [];
  return { problem: typeof o.problem === "string" ? o.problem : "", features: strings(o.features, 3), roles };
}

/** 반 일정 기준 단계별 목표일과 오늘 목표 단계 */
export async function getTeamSchedule(cohortId: number, today: string): Promise<TeamSchedule> {
  const c = await db.cohort.findUniqueOrThrow({ where: { id: cohortId }, select: { startDate: true, endDate: true } });
  const start = dateToYmd(c.startDate);
  const end = dateToYmd(c.endDate);
  return { targets: stageTargetDates(start, end), expected: expectedStage(start, end, today), today };
}

function behindOf(stage: number, s: TeamSchedule) {
  return stage < s.expected;
}

/** 반의 팀 목록 (강사 표·현황) */
export async function listTeams(cohortId: number, today: string): Promise<{ rows: TeamRow[]; schedule: TeamSchedule }> {
  const [schedule, teams] = await Promise.all([
    getTeamSchedule(cohortId, today),
    db.team.findMany({
      where: { cohortId },
      include: {
        leader: { select: { name: true } },
        _count: { select: { members: true } },
        project: {
          include: {
            milestones: { where: { cohortId, done: true }, select: { checkKey: true } },
            logs: { where: { cohortId }, orderBy: { updatedAt: "desc" }, take: 1, select: { updatedAt: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);
  const rows = teams.map((t) => {
    const stage = toStage(t.project?.stage ?? 1);
    const keys = STAGES[stage - 1].checkpoints.map((c) => c.key);
    const done = new Set(t.project?.milestones.map((m) => m.checkKey));
    const last = t.project?.logs[0]?.updatedAt;
    return {
      id: t.id,
      name: t.name,
      projectTitle: t.project?.title ?? "",
      leaderName: t.leader.name,
      memberCount: t._count.members,
      stage,
      stageDone: keys.filter((k) => done.has(k)).length,
      stageTotal: keys.length,
      behind: behindOf(stage, schedule),
      lastLogAt: last ? formatDateTime(last).slice(0, 10) : null,
    };
  });
  return { rows, schedule };
}

type TeamDetailBase = Omit<TeamDetail, "behind" | "schedule">;

async function findTeamDetail(cohortId: number, where: { id?: number; memberUserId?: number }): Promise<TeamDetailBase | null> {
  const team = await db.team.findFirst({
    where: {
      cohortId,
      ...(where.id !== undefined ? { id: where.id } : {}),
      ...(where.memberUserId !== undefined ? { members: { some: { userId: where.memberUserId, cohortId } } } : {}),
    },
    include: {
      members: { include: { user: { select: { name: true, loginId: true } } }, orderBy: { joinedAt: "asc" } },
      project: {
        include: {
          milestones: { where: { cohortId } },
          feedbacks: { where: { cohortId }, include: { instructor: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
          logs: { where: { cohortId }, include: { user: { select: { name: true } } }, orderBy: [{ weekOf: "desc" }, { updatedAt: "desc" }] },
        },
      },
    },
  });
  if (!team || !team.project) return null;
  const p = team.project;
  const stage = toStage(p.stage);
  return {
    id: team.id,
    name: team.name,
    status: team.status,
    leaderId: team.leaderId,
    members: team.members
      .map((m) => ({ userId: m.userId, name: m.user.name, loginId: m.user.loginId, role: m.role, isLeader: m.userId === team.leaderId }))
      .sort((a, b) => Number(b.isLeader) - Number(a.isLeader)),
    project: {
      id: p.id,
      title: p.title,
      summary: p.summary,
      plan: parsePlan(p.plan),
      repoUrl: p.repoUrl,
      deployUrl: p.deployUrl,
      techStack: strings(p.techStack),
      stage,
      stageUpdatedAt: p.stageUpdatedAt ? formatDateTime(p.stageUpdatedAt) : null,
    },
    checks: Object.fromEntries(p.milestones.map((m) => [m.checkKey, { done: m.done, doneAt: m.doneAt ? formatDateTime(m.doneAt).slice(0, 10) : null }])),
    feedbacks: p.feedbacks.map((f) => ({
      id: f.id,
      instructorName: f.instructor.name,
      stage: f.stage,
      comment: f.comment,
      createdAt: formatDateTime(f.createdAt),
    })),
    logs: p.logs.map((l) => ({
      id: l.id,
      userId: l.userId,
      userName: l.user.name,
      weekOf: dateToYmd(l.weekOf),
      progress: l.progress,
      blocker: l.blocker,
      resolution: l.resolution,
      metric: l.metric,
      updatedAt: formatDateTime(l.updatedAt),
    })),
  };
}

async function withSchedule(cohortId: number, detail: TeamDetailBase | null, today: string): Promise<TeamDetail | null> {
  if (!detail) return null;
  const schedule = await getTeamSchedule(cohortId, today);
  return { ...detail, schedule, behind: behindOf(detail.project.stage, schedule) };
}

/** 팀 상세 (강사·매니저 드로어). 수강생 본인 팀 여부는 호출 측에서 검사한다. */
export async function getTeamDetail(cohortId: number, teamId: number, today: string) {
  return withSchedule(cohortId, await findTeamDetail(cohortId, { id: teamId }), today);
}

/** 수강생 본인 팀 */
export async function getMyTeam(cohortId: number, userId: number, today: string) {
  return withSchedule(cohortId, await findTeamDetail(cohortId, { memberUserId: userId }), today);
}

/** 팀 구성원 id (리소스 단위 권한 검사용) */
export async function getTeamAccessInfo(cohortId: number, teamId: number) {
  const t = await db.team.findFirst({
    where: { id: teamId, cohortId },
    select: { id: true, cohortId: true, members: { select: { userId: true } }, project: { select: { id: true, stage: true } } },
  });
  return t && t.project
    ? { teamId: t.id, cohortId: t.cohortId, memberIds: t.members.map((m) => m.userId), projectId: t.project.id, stage: t.project.stage }
    : null;
}

export type TeamCandidate = { id: number; name: string; loginId: string; teamName: string | null };

/** 팀 만들기 드로어: 재적 수강생과 현재 소속 팀 */
export async function listTeamCandidates(cohortId: number): Promise<TeamCandidate[]> {
  const students = await db.user.findMany({
    where: { role: Role.STUDENT, enrollments: { some: { cohortId, status: EnrollmentStatus.ENROLLED } } },
    select: { id: true, name: true, loginId: true, teamMemberships: { where: { cohortId }, select: { team: { select: { name: true } } } } },
    orderBy: { loginId: "asc" },
  });
  return students.map((s) => ({ id: s.id, name: s.name, loginId: s.loginId, teamName: s.teamMemberships[0]?.team.name ?? null }));
}

export type TeamStatusSummary = {
  total: number;
  byStage: Record<StageNo, number>;
  behind: TeamRow[];
  unassigned: number;
  expected: StageNo;
};

/** 홈 위젯·매니저 현황: 단계별 팀 수, 지연 팀, 미배정 수강생 수 */
export async function getTeamStatusSummary(cohortId: number, today: string): Promise<TeamStatusSummary & { rows: TeamRow[] }> {
  const [{ rows, schedule }, enrolled, assigned] = await Promise.all([
    listTeams(cohortId, today),
    db.enrollment.count({ where: { cohortId, status: EnrollmentStatus.ENROLLED } }),
    db.teamMember.count({ where: { cohortId, user: { enrollments: { some: { cohortId, status: EnrollmentStatus.ENROLLED } } } } }),
  ]);
  const byStage: Record<StageNo, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const r of rows) byStage[r.stage] += 1;
  return { total: rows.length, byStage, behind: rows.filter((r) => r.behind), unassigned: Math.max(0, enrolled - assigned), expected: schedule.expected, rows };
}
