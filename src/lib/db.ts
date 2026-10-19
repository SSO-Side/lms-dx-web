// Prisma DB 클라이언트 하나를 만들어 공유한다. DB 호출은 src/server/에서만 한다.
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/** 앱 전체가 함께 쓰는 Prisma 클라이언트(개발 중 핫 리로드에도 하나만 유지) */
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
