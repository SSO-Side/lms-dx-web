"use server";

// 팀 프로젝트(M5) 서버 액션: 팀 생성, 기획안·체크·로그 작성, 피드백, 단계 승인.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { EnrollmentStatus, Prisma, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireCohortAccess, AccessDeniedError, type CohortContext } from "@/lib/access/requireCohortAccess";
import { tryCohortAccess } from "@/lib/access/pageAccess";
import { hasActionPermission } from "@/lib/access/permissions";
import { canEditTeamProjectPure, canViewTeamProjectPure } from "@/lib/access/checker";
import { isYmd, todayYmd, ymdToDate } from "@/lib/dates";
import { STAGES, isStageNo, stageOfCheckKey, weekOfYmd } from "@/lib/team/guide";
import { getTeamAccessInfo, getTeamDetail, type TeamDetail } from "./team-queries";

type Result = { ok: true; teamId?: number } | { ok: false; error: string };

async function wrap(fn: () => Promise<Result>): Promise<Result> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AccessDeniedError) return { ok: false, error: "권한이 없습니다." };
    throw e;
  }
}

function refresh(cohortId: number) {
  revalidatePath(`/app/c/${cohortId}/team`);
  revalidatePath(`/app/c/${cohortId}`);
}

function firstError(e: z.ZodError) {
  return e.issues[0]?.message ?? "입력값 오류";
}

const NOT_FOUND = "팀을 찾을 수 없습니다.";

type TeamAccess = NonNullable<Awaited<ReturnType<typeof getTeamAccessInfo>>>;

/** 반 접근(team:write) 뒤 본인 팀인지 리소스 단위 검사 */
async function loadOwnTeam(ctx: CohortContext, teamId: number): Promise<TeamAccess | null> {
  const team = await getTeamAccessInfo(ctx.cohortId, teamId);
  if (!team || !canEditTeamProjectPure({ id: ctx.user.id, role: ctx.role }, ctx.cohortId, team)) return null;
  return team;
}

// http(s)만 허용 (javascript: 등 차단)
const urlField = z
  .string()
  .trim()
  .max(500, "URL은 500자 이내로 입력해 주세요.")
  .refine((v) => v === "" || /^https?:\/\/[^\s]+$/i.test(v), "http:// 또는 https:// 로 시작하는 주소를 입력해 주세요.")
  .transform((v) => v || null);

const stageField = z.number().int().refine(isStageNo, "단계를 선택해 주세요.");

const createSchema = z.object({
  name: z.string().trim().min(1, "팀 이름을 입력해 주세요.").max(100),
  projectTitle: z.string().trim().min(1, "프로젝트 이름을 입력해 주세요.").max(200),
  leaderId: z.number().int().positive("팀장을 선택해 주세요."),
  memberIds: z.array(z.number().int().positive()).max(10, "팀원은 10명 이내로 배정해 주세요."),
  stage: stageField,
});

/** 팀 만들기 (강사): 팀 + 팀원 + 프로젝트. 초기 단계가 2 이상이면 이전 단계 체크포인트는 현황 등록으로 완료 처리 */
export async function createTeamAction(cohortId: number, input: z.input<typeof createSchema>): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "team:manage");
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const { name, projectTitle, leaderId, stage } = parsed.data;
    const memberIds = [...new Set([leaderId, ...parsed.data.memberIds])];

    // 모두 이 반 재적 수강생이고 다른 팀에 속하지 않아야 한다
    const students = await db.user.findMany({
      where: { id: { in: memberIds }, role: Role.STUDENT, enrollments: { some: { cohortId: ctx.cohortId, status: EnrollmentStatus.ENROLLED } } },
      select: { id: true, teamMemberships: { where: { cohortId: ctx.cohortId }, select: { id: true } } },
    });
    if (students.length !== memberIds.length) return { ok: false, error: "이 반의 재적 수강생만 배정할 수 있습니다." };
    if (students.some((s) => s.teamMemberships.length > 0)) return { ok: false, error: "이미 다른 팀에 속한 수강생이 있습니다." };

    const now = new Date();
    try {
      const team = await db.$transaction(async (tx) => {
        const t = await tx.team.create({ data: { cohortId: ctx.cohortId, name, leaderId, status: "CONFIRMED" } });
        await tx.teamMember.createMany({
          data: memberIds.map((userId) => ({ teamId: t.id, cohortId: ctx.cohortId, userId, role: userId === leaderId ? "팀장" : null })),
        });
        const p = await tx.teamProject.create({
          data: { teamId: t.id, cohortId: ctx.cohortId, title: projectTitle, techStack: [], stage, stageUpdatedAt: now },
        });
        const earlier = STAGES.filter((s) => s.stage < stage).flatMap((s) => s.checkpoints.map((c) => ({ stage: s.stage, key: c.key })));
        if (earlier.length > 0) {
          await tx.projectMilestone.createMany({
            data: earlier.map((c) => ({
              projectId: p.id,
              cohortId: ctx.cohortId,
              stage: c.stage,
              checkKey: c.key,
              done: true,
              doneAt: now,
              doneById: ctx.user.id,
            })),
          });
        }
        return t;
      });
      refresh(ctx.cohortId);
      return { ok: true, teamId: team.id };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return { ok: false, error: "같은 이름의 팀이 있거나, 이미 다른 팀에 속한 수강생이 있습니다." };
      }
      throw e;
    }
  });
}

/** 팀 상세 (드로어). 교직원은 반 전체, 수강생은 본인 팀만 */
export async function getTeamDetailAction(cohortId: number, teamId: number): Promise<{ ok: true; detail: TeamDetail } | { ok: false; error: string }> {
  const ctx = await tryCohortAccess(cohortId, "team:feedback");
  if (!ctx) return { ok: false, error: "권한이 없습니다." };
  const access = await getTeamAccessInfo(ctx.cohortId, teamId);
  if (!access || !canViewTeamProjectPure({ id: ctx.user.id, role: ctx.role }, ctx.cohortId, access)) return { ok: false, error: NOT_FOUND };
  const detail = await getTeamDetail(ctx.cohortId, teamId, todayYmd());
  if (!detail) return { ok: false, error: NOT_FOUND };
  return { ok: true, detail };
}

/** 체크포인트·완료 체크리스트 체크 (수강생 본인 팀, 또는 강사) */
export async function toggleCheckAction(cohortId: number, teamId: number, checkKey: string, done: boolean): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "team:feedback");
    const access = await getTeamAccessInfo(ctx.cohortId, teamId);
    const allowed =
      !!access &&
      (hasActionPermission(ctx.role, "team:manage")
        ? access.cohortId === ctx.cohortId
        : hasActionPermission(ctx.role, "team:write") && canEditTeamProjectPure({ id: ctx.user.id, role: ctx.role }, ctx.cohortId, access));
    if (!access || !allowed) return { ok: false, error: NOT_FOUND };
    const stage = stageOfCheckKey(checkKey);
    if (stage === null) return { ok: false, error: "알 수 없는 체크 항목입니다." };

    const data = { done, doneAt: done ? new Date() : null, doneById: done ? ctx.user.id : null };
    await db.projectMilestone.upsert({
      where: { projectId_checkKey: { projectId: access.projectId, checkKey } },
      create: { projectId: access.projectId, cohortId: ctx.cohortId, stage, checkKey, ...data },
      update: data,
    });
    refresh(ctx.cohortId);
    return { ok: true, teamId };
  });
}

const planSchema = z.object({
  title: z.string().trim().min(1, "프로젝트 이름을 입력해 주세요.").max(200),
  summary: z.string().trim().max(2000, "소개는 2000자 이내로 입력해 주세요."),
  problem: z.string().trim().max(300, "문제 정의는 300자 이내로 입력해 주세요."),
  features: z.array(z.string().trim().max(100)).max(3, "핵심 기능은 3개 이내로 적어 주세요."),
  techStack: z.array(z.string().trim().min(1).max(40)).max(15, "기술 스택은 15개 이내로 입력해 주세요."),
  roles: z.array(z.object({ name: z.string().trim().max(50), part: z.string().trim().max(200) })).max(10),
  repoUrl: urlField,
  deployUrl: urlField,
});

/** 기획안·저장소·배포 URL 저장 (수강생 본인 팀) */
export async function saveProjectPlanAction(cohortId: number, teamId: number, input: z.input<typeof planSchema>): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "team:write");
    const team = await loadOwnTeam(ctx, teamId);
    if (!team) return { ok: false, error: NOT_FOUND };
    const parsed = planSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const d = parsed.data;
    await db.teamProject.update({
      where: { id: team.projectId, cohortId: ctx.cohortId },
      data: {
        title: d.title,
        summary: d.summary || null,
        plan: { problem: d.problem, features: d.features.filter(Boolean), roles: d.roles.filter((r) => r.name || r.part) },
        techStack: [...new Set(d.techStack)],
        repoUrl: d.repoUrl,
        deployUrl: d.deployUrl,
      },
    });
    refresh(ctx.cohortId);
    return { ok: true, teamId };
  });
}

const logSchema = z.object({
  date: z.string().refine(isYmd, "날짜 형식이 올바르지 않습니다."),
  progress: z.string().trim().min(1, "이번 주 진행 내용을 입력해 주세요.").max(2000),
  blocker: z.string().trim().max(2000),
  resolution: z.string().trim().max(2000),
  metric: z.string().trim().max(200),
});

/** 개인 주간 로그 (수강생 본인 팀). 같은 주에 다시 쓰면 수정 */
export async function saveProjectLogAction(cohortId: number, teamId: number, input: z.input<typeof logSchema>): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "team:write");
    const team = await loadOwnTeam(ctx, teamId);
    if (!team) return { ok: false, error: NOT_FOUND };
    const parsed = logSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const d = parsed.data;
    if (d.date > todayYmd()) return { ok: false, error: "미래 주차의 로그는 쓸 수 없습니다." };
    const weekOf = ymdToDate(weekOfYmd(d.date));
    const data = { progress: d.progress, blocker: d.blocker || null, resolution: d.resolution || null, metric: d.metric || null };
    await db.projectLog.upsert({
      where: { projectId_userId_weekOf: { projectId: team.projectId, userId: ctx.user.id, weekOf } },
      create: { projectId: team.projectId, cohortId: ctx.cohortId, userId: ctx.user.id, weekOf, ...data },
      update: data,
    });
    refresh(ctx.cohortId);
    return { ok: true, teamId };
  });
}

const commentSchema = z.string().trim().min(1, "피드백 내용을 입력해 주세요.").max(2000, "피드백은 2000자 이내로 입력해 주세요.");

/** 강사 피드백 (현재 단계 기준으로 기록) */
export async function addFeedbackAction(cohortId: number, teamId: number, comment: string): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "team:manage");
    const parsed = commentSchema.safeParse(comment);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const team = await getTeamAccessInfo(ctx.cohortId, teamId);
    if (!team) return { ok: false, error: NOT_FOUND };
    await db.projectFeedback.create({
      data: { projectId: team.projectId, cohortId: ctx.cohortId, instructorId: ctx.user.id, stage: team.stage, comment: parsed.data },
    });
    refresh(ctx.cohortId);
    return { ok: true, teamId };
  });
}

/** 단계 승인 (강사): 현재 단계 → 다음 단계. 코멘트가 있으면 피드백으로 남긴다 */
export async function advanceStageAction(cohortId: number, teamId: number, comment: string | null): Promise<Result> {
  return wrap(async () => {
    const ctx = await requireCohortAccess(cohortId, "team:manage");
    const team = await getTeamAccessInfo(ctx.cohortId, teamId);
    if (!team) return { ok: false, error: NOT_FOUND };
    if (team.stage >= 4) return { ok: false, error: "마지막 단계입니다." };
    const note = comment?.trim() ? commentSchema.safeParse(comment) : null;
    if (note && !note.success) return { ok: false, error: firstError(note.error) };

    const moved = await db.$transaction(async (tx) => {
      const r = await tx.teamProject.updateMany({
        where: { id: team.projectId, cohortId: ctx.cohortId, stage: team.stage },
        data: { stage: team.stage + 1, stageUpdatedAt: new Date() },
      });
      if (r.count !== 1) return false;
      await tx.projectFeedback.create({
        data: {
          projectId: team.projectId,
          cohortId: ctx.cohortId,
          instructorId: ctx.user.id,
          stage: team.stage,
          comment: note?.success ? `[${team.stage}단계 승인] ${note.data}` : `[${team.stage}단계 승인] 다음 단계로 진행합니다.`,
        },
      });
      return true;
    });
    if (!moved) return { ok: false, error: "다른 사람이 먼저 처리했습니다. 새로고침해 주세요." };
    refresh(ctx.cohortId);
    return { ok: true, teamId };
  });
}
