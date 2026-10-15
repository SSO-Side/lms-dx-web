import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { User } from "@prisma/client";

const SESSION_COOKIE_NAME = "session_token";
const SESSION_DURATION_DAYS = 7;

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

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

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (rawToken) {
    const tokenHash = hashToken(rawToken);
    await db.authSession.delete({ where: { id: tokenHash } }).catch(() => {});
    cookieStore.delete(SESSION_COOKIE_NAME);
  }
}
