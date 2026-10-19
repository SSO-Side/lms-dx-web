"use server";

// 로그인 서버 액션: 로그인(실패 횟수 제한 포함), 로그아웃, 비밀번호 변경.
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, getSessionUser } from "@/lib/auth/session";
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from "@/lib/auth/rate-limit";

const loginSchema = z.object({
  loginId: z.string().min(1, "ID를 입력해 주세요."),
  password: z.string().min(1, "비밀번호를 입력해 주세요."),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "현재 비밀번호를 입력해 주세요."),
  newPassword: z.string().min(8, "새 비밀번호는 8자 이상이어야 합니다."),
  confirmPassword: z.string().min(8, "비밀번호 확인을 입력해 주세요."),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "새 비밀번호가 일치하지 않습니다.",
  path: ["confirmPassword"],
});

const UNIFORM_AUTH_ERROR = "ID 또는 비밀번호가 올바르지 않습니다.";

/** 로그인: 아이디·비밀번호 확인, 실패 횟수 제한, 세션 생성 후 역할별 홈으로 이동. */
export async function loginAction(prevState: unknown, formData: FormData) {
  const rawData = {
    loginId: formData.get("loginId"),
    password: formData.get("password"),
  };

  const parsed = loginSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: UNIFORM_AUTH_ERROR };
  }

  const { loginId, password } = parsed.data;

  if (!checkRateLimit(loginId)) {
    return { error: UNIFORM_AUTH_ERROR };
  }

  const user = await db.user.findUnique({
    where: { loginId },
  });

  if (!user || user.status !== "ACTIVE") {
    recordFailedAttempt(loginId);
    return { error: UNIFORM_AUTH_ERROR };
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    recordFailedAttempt(loginId);
    return { error: UNIFORM_AUTH_ERROR };
  }

  resetRateLimit(loginId);

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await createSession(user.id);

  if (user.mustChangePassword) {
    redirect("/app/password");
  } else {
    redirect("/app");
  }
}

/** 로그아웃 후 로그인 화면으로 이동. */
export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

/** 비밀번호 변경(현재 비밀번호 확인, 임시 비밀번호 표시 해제). */
export async function changePasswordAction(prevState: unknown, formData: FormData) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const rawData = {
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  };

  const parsed = changePasswordSchema.safeParse(rawData);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다.";
    return { error: firstError };
  }

  const { currentPassword, newPassword } = parsed.data;

  const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isCurrentValid) {
    return { error: "현재 비밀번호가 올바르지 않습니다." };
  }

  const newHash = await bcrypt.hash(newPassword, 10);

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newHash,
      mustChangePassword: false,
    },
  });

  redirect("/app");
}
