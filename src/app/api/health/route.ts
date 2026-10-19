// 상태 확인 API(/api/health): 서버와 DB가 살아 있는지 확인하는 용도(배포·모니터링).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** 서버·DB 상태 확인: DB에 SELECT 1을 보내 성공하면 ok, 실패하면 500. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
