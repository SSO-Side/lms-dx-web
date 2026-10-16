"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkRateLimit, recordFailedAttempt } from "@/lib/auth/rate-limit";

// 공개 리드 접수 (로그인 없음, 반 권한의 예외). 대상 쇼케이스는 slug + PUBLISHED로만 찾고, cohortId는 쇼케이스에서 꺼낸다.
// 입력은 텍스트 그대로 저장하고, 화면은 React 텍스트 노드로만 출력한다 (HTML로 해석하지 않음).

const LEAD_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 }; // IP당 1시간 5건

const leadSchema = z.object({
  type: z.enum(["COFFEE_CHAT", "POC"], { message: "문의 유형을 선택해 주세요." }),
  company: z.string().trim().min(1, "기업명을 입력해 주세요.").max(100, "기업명은 100자 이내로 입력해 주세요."),
  contactName: z.string().trim().min(1, "담당자 이름을 입력해 주세요.").max(50, "담당자 이름은 50자 이내로 입력해 주세요."),
  contact: z.string().trim().min(5, "이메일 또는 전화번호를 입력해 주세요.").max(100, "연락처는 100자 이내로 입력해 주세요."),
  message: z.string().trim().min(10, "문의 내용을 10자 이상 입력해 주세요.").max(2000, "문의 내용은 2000자 이내로 입력해 주세요."),
});

export type LeadResult = { ok: true } | { ok: false; error: string };

/** 요청 IP. 운영에서는 Nginx가 X-Forwarded-For를 덮어써야 위조를 막을 수 있다 (PROGRESS 사람 작업). */
async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "unknown";
}

export async function submitLeadAction(slug: string, formData: FormData): Promise<LeadResult> {
  // 허니팟: 사람에게 보이지 않는 칸이 채워져 있으면 봇으로 보고, 성공처럼 응답만 한다
  if (String(formData.get("website") ?? "").trim() !== "") return { ok: true };

  const key = `lead:${await clientIp()}`;
  if (!checkRateLimit(key, LEAD_LIMIT)) return { ok: false, error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." };

  const parsed = leadSchema.safeParse({
    type: formData.get("type"),
    company: formData.get("company") ?? "",
    contactName: formData.get("contactName") ?? "",
    contact: formData.get("contact") ?? "",
    message: formData.get("message") ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };

  const showcase = typeof slug === "string" && slug.length <= 40
    ? await db.showcase.findFirst({ where: { slug, status: "PUBLISHED" }, select: { id: true, cohortId: true } })
    : null;
  if (!showcase) return { ok: false, error: "공개 중인 프로젝트가 아닙니다." };

  recordFailedAttempt(key, LEAD_LIMIT); // 접수 건수 기준으로 센다
  await db.inboundLead.create({ data: { ...parsed.data, showcaseId: showcase.id, cohortId: showcase.cohortId } });
  revalidatePath(`/app/c/${showcase.cohortId}/leads`);
  revalidatePath(`/app/c/${showcase.cohortId}`);
  return { ok: true };
}
