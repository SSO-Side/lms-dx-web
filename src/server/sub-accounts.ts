"use server";

// 서브 계정 서버 액션: 슈퍼어드민(ACADEMY_ADMIN)이 자기 학원의 서브 관리자(MANAGER) 계정을 발급·재설정·비활성화한다.
// 대상 학원은 항상 로그인 계정의 academyId이고, 요청 값으로 학원을 받지 않는다.
import bcrypt from "bcryptjs";
import { z } from "zod";
import { ActiveStatus, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuthUser } from "@/lib/auth/session";
import { generateTempPassword } from "@/lib/auth/temp-password";
import { canManageSubAccountsPure } from "@/lib/access/checker";
import { deactivateUserWithHandOff } from "./staff-handoff";

type Result = { ok: true; tempPassword?: string } | { ok: false; error: string };

const DENIED: Result = { ok: false, error: "서브 계정을 관리할 권한이 없습니다." };

const createSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요.").max(50),
  loginId: z
    .string()
    .trim()
    .min(3, "로그인 ID는 3자 이상이어야 합니다.")
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/, "로그인 ID는 영문, 숫자, _, - 만 가능합니다."),
  phone: z.string().trim().max(30).optional(),
});

const userIdSchema = z.number().int().positive();

/** 슈퍼어드민인지 확인하고 학원 ID를 돌려준다. 아니면 null. */
async function requireSuperAdmin() {
  const user = await requireAuthUser();
  return canManageSubAccountsPure(user) ? user : null;
}

/** 같은 학원의 서브 관리자 계정만 찾는다. 다른 학원·다른 역할이면 null. */
async function findSubAccount(academyId: number, targetUserId: number) {
  if (!userIdSchema.safeParse(targetUserId).success) return null;
  return db.user.findFirst({ where: { id: targetUserId, academyId, role: Role.MANAGER }, select: { id: true, status: true } });
}

/** 서브 관리자 계정을 발급하고 임시 비밀번호를 한 번만 돌려준다. */
export async function createSubAccountAction(input: { name: string; loginId: string; phone?: string }): Promise<Result> {
  const admin = await requireSuperAdmin();
  if (!admin) return DENIED;

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };

  const exists = await db.user.findUnique({ where: { loginId: parsed.data.loginId }, select: { id: true } });
  if (exists) return { ok: false, error: "이미 사용 중인 로그인 ID입니다." };

  const tempPassword = generateTempPassword(10);
  await db.user.create({
    data: {
      academyId: admin.academyId,
      role: Role.MANAGER,
      loginId: parsed.data.loginId,
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      passwordHash: await bcrypt.hash(tempPassword, 10),
      mustChangePassword: true,
      status: ActiveStatus.ACTIVE,
    },
  });
  return { ok: true, tempPassword };
}

/** 서브 관리자 비밀번호를 임시 비밀번호로 재설정한다. */
export async function resetSubAccountPasswordAction(targetUserId: number): Promise<Result> {
  const admin = await requireSuperAdmin();
  if (!admin) return DENIED;

  const target = await findSubAccount(admin.academyId, targetUserId);
  if (!target) return { ok: false, error: "이 학원의 서브 계정이 아닙니다." };

  const tempPassword = generateTempPassword(10);
  await db.$transaction([
    db.user.update({ where: { id: target.id }, data: { passwordHash: await bcrypt.hash(tempPassword, 10), mustChangePassword: true } }),
    db.authSession.deleteMany({ where: { userId: target.id } }),
  ]);
  return { ok: true, tempPassword };
}

/** 서브 관리자 계정을 비활성화한다. 맡은 반의 주담당을 풀고 미완료 티켓을 넘긴다. */
export async function deactivateSubAccountAction(targetUserId: number): Promise<Result> {
  const admin = await requireSuperAdmin();
  if (!admin) return DENIED;

  const target = await findSubAccount(admin.academyId, targetUserId);
  if (!target) return { ok: false, error: "이 학원의 서브 계정이 아닙니다." };
  if (target.status !== ActiveStatus.ACTIVE) return { ok: false, error: "이미 비활성화된 계정입니다." };

  await deactivateUserWithHandOff(target.id);
  return { ok: true };
}
