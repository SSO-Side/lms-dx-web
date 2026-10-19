// 로그인 세션: 세션 생성·조회·삭제. 세션은 DB에 저장하고 쿠키에는 난수 토큰만 둔다.
import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { User } from "@prisma/client";

const SESSION_COOKIE_NAME = "session_token";
const SESSION_DURATION_DAYS = 7;

/** 쿠키 토큰을 DB 저장용 해시로 바꾼다(DB가 새도 토큰은 알 수 없게). */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** 로그인 성공 시 세션을 만들고 쿠키를 심는다. */
export async function createSession(userId: number): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  await db.authSession.create({
    data: {
      id: tokenHash,
      userId,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  });

  return rawToken;
}

/** 현재 로그인 사용자. 없거나 만료·비활성 계정이면 null. */
export async function getSessionUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!rawToken) {
    return null;
  }

  const tokenHash = hashToken(rawToken);

  const session = await db.authSession.findUnique({
    where: { id: tokenHash },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  // 만료 검사
  if (session.expiresAt <= new Date()) {
    await db.authSession.delete({ where: { id: tokenHash } }).catch(() => {});
    return null;
  }

  // 비활성화 계정 거부
  if (session.user.status !== "ACTIVE") {
    return null;
  }

  return session.user;
}

/** 로그인 필수 페이지용: 로그인 안 했으면 /login으로 보낸다. */
export async function requireAuthUser(options?: { allowMustChangePassword?: boolean }): Promise<User> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  if (!options?.allowMustChangePassword && user.mustChangePassword) {
    redirect("/app/password");
  }
  return user;
}

/** 로그아웃: 세션을 지우고 쿠키를 없앤다. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (rawToken) {
    const tokenHash = hashToken(rawToken);
    await db.authSession.delete({ where: { id: tokenHash } }).catch(() => {});
    cookieStore.delete(SESSION_COOKIE_NAME);
  }
}
