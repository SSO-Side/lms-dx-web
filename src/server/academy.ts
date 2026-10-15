"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Role, StaffRole, EnrollmentStatus, ActiveStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuthUser } from "@/lib/auth/session";
import { requireCohortAccess } from "@/lib/access/requireCohortAccess";
import { parseRosterCSV, type ParsedAccountRow } from "@/lib/csv";
import { z } from "zod";
import { isYmd, ymdToDate } from "@/lib/dates";
import { DEFAULT_ATTENDANCE_CONFIG } from "@/lib/attendance/compute";
import { DEFAULT_WEEKLY_SCHEDULE, generateMonthlyPeriods, generateTrainingDays } from "@/lib/attendance/schedule";

function generateTempPassword(length = 10): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$";
  let result = "";
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
}

const cohortInputSchema = z.object({
  name: z.string().trim().min(1, "과정명은 필수입니다.").max(200),
  trainingType: z.string().trim().max(100).optional(),
  room: z.string().trim().max(100).optional(),
  startDate: z.string().refine(isYmd, "시작일 형식이 올바르지 않습니다."),
  endDate: z.string().refine(isYmd, "종료일 형식이 올바르지 않습니다."),
  weeklySchedule: z.record(z.string().regex(/^[0-6]$/), z.tuple([z.string(), z.string()])),
  holidays: z.array(z.string().refine(isYmd)),
  staff: z.array(z.object({ userId: z.number().int(), isPrimary: z.boolean() })),
});

export async function createCohortAction(prevState: unknown, formData: FormData) {
  const user = await requireAuthUser();
  if (user.role !== Role.ACADEMY_ADMIN && user.role !== Role.ADMIN) {
    return { error: "반 개설 권한이 없습니다." };
  }

  const parseJson = (key: string) => {
    try {
      return JSON.parse((formData.get(key) as string) || "null");
    } catch {
      return null;
    }
  };
  const parsed = cohortInputSchema.safeParse({
    name: formData.get("name"),
    trainingType: formData.get("trainingType") || undefined,
    room: formData.get("room") || undefined,
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    weeklySchedule: parseJson("weeklySchedule") ?? DEFAULT_WEEKLY_SCHEDULE,
    holidays: parseJson("holidays") ?? [],
    staff: parseJson("staff") ?? [],
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
  }
  const input = parsed.data;
  if (input.endDate < input.startDate) {
    return { error: "종료일은 시작일 이후여야 합니다." };
  }
  if (Object.keys(input.weeklySchedule).length === 0) {
    return { error: "수업 요일을 하나 이상 선택해 주세요." };
  }

  const academyId = user.academyId ?? 1;

  // 담당자는 같은 학원의 매니저·강사만 배정한다.
  const staffUsers = input.staff.length
    ? await db.user.findMany({
        where: {
          id: { in: input.staff.map((s) => s.userId) },
          academyId,
          role: { in: [Role.MANAGER, Role.INSTRUCTOR] },
          status: ActiveStatus.ACTIVE,
        },
        select: { id: true, role: true },
      })
    : [];
  if (staffUsers.length !== input.staff.length) {
    return { error: "배정할 수 없는 담당자가 포함되어 있습니다." };
  }

  const holidays = [...new Set(input.holidays)].filter((d) => d >= input.startDate && d <= input.endDate).sort();
  const trainingDays = generateTrainingDays(input.startDate, input.endDate, input.weeklySchedule, holidays);
  const periods = generateMonthlyPeriods(input.startDate, input.endDate);

  const cohort = await db.$transaction(async (tx) => {
    const created = await tx.cohort.create({
      data: {
        academyId,
        name: input.name,
        trainingType: input.trainingType || "K-Digital Training",
        room: input.room || null,
        startDate: ymdToDate(input.startDate),
        endDate: ymdToDate(input.endDate),
        weeklySchedule: input.weeklySchedule,
        holidays,
        attendanceConfig: DEFAULT_ATTENDANCE_CONFIG,
      },
    });
    await tx.trainingDay.createMany({
      data: trainingDays.map((d) => ({ cohortId: created.id, date: ymdToDate(d.date), isTraining: d.isTraining, note: d.note ?? null })),
    });
    await tx.attendancePeriod.createMany({
      data: periods.map((p) => ({ cohortId: created.id, label: p.label, startDate: ymdToDate(p.startDate), endDate: ymdToDate(p.endDate) })),
    });
    if (staffUsers.length) {
      await tx.cohortStaff.createMany({
        data: staffUsers.map((u) => ({
          cohortId: created.id,
          userId: u.id,
          staffRole: u.role === Role.MANAGER ? StaffRole.MANAGER : StaffRole.INSTRUCTOR,
          isPrimary: u.role === Role.MANAGER && !!input.staff.find((s) => s.userId === u.id)?.isPrimary,
        })),
      });
    }
    return created;
  });

  return { success: true, cohortId: cohort.id };
}

export async function parseRosterCSVAction(cohortId: number, csvText: string) {
  await requireCohortAccess(cohortId, "account:manage");
  return parseRosterCSV(csvText);
}

export async function bulkIssueAccountsAction(cohortId: number, validRows: ParsedAccountRow[]) {
  const ctx = await requireCohortAccess(cohortId, "account:manage");

  const cohort = await db.cohort.findUnique({
    where: { id: ctx.cohortId },
    select: { academyId: true },
  });

  if (!cohort) {
    return { error: "반 정보를 찾을 수 없습니다." };
  }

  const results: Array<{
    name: string;
    loginId: string;
    role: Role;
    tempPassword: string;
  }> = [];

  for (const row of validRows) {
    const existing = await db.user.findUnique({
      where: { loginId: row.loginId },
    });

    if (existing) {
      continue; // 이미 존재하는 ID는 건너뜀
    }

    const tempPassword = generateTempPassword(10);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const newUser = await db.user.create({
      data: {
        academyId: cohort.academyId,
        role: row.role,
        loginId: row.loginId,
        name: row.name,
        phone: row.phone || null,
        passwordHash,
        mustChangePassword: true,
        status: ActiveStatus.ACTIVE,
      },
    });

    if (row.role === Role.STUDENT) {
      await db.enrollment.create({
        data: {
          cohortId: ctx.cohortId,
          studentId: newUser.id,
          status: EnrollmentStatus.ENROLLED,
        },
      });
    } else if (row.role === Role.INSTRUCTOR) {
      await db.cohortStaff.create({
        data: {
          cohortId: ctx.cohortId,
          userId: newUser.id,
          staffRole: StaffRole.INSTRUCTOR,
        },
      });
    } else if (row.role === Role.MANAGER) {
      await db.cohortStaff.create({
        data: {
          cohortId: ctx.cohortId,
          userId: newUser.id,
          staffRole: StaffRole.MANAGER,
        },
      });
    }

    results.push({
      name: row.name,
      loginId: row.loginId,
      role: row.role,
      tempPassword,
    });
  }

  // 임시 비밀번호 1회용 CSV 문자열 생성 (서버 평문 미저장)
  let csvContent = "\uFEFF이름,로그인ID,역할,임시비밀번호\n";
  for (const r of results) {
    csvContent += `"${r.name}","${r.loginId}","${r.role}","${r.tempPassword}"\n`;
  }

  return {
    success: true,
    issuedCount: results.length,
    csvContent,
  };
}

export async function resetPasswordAction(cohortId: number, targetUserId: number) {
  await requireCohortAccess(cohortId, "account:manage");

  const targetUser = await db.user.findUnique({
    where: { id: targetUserId },
  });

  if (!targetUser) {
    return { error: "대상 사용자를 찾을 수 없습니다." };
  }

  const tempPassword = generateTempPassword(10);
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  await db.user.update({
    where: { id: targetUserId },
    data: {
      passwordHash,
      mustChangePassword: true,
    },
  });

  return { success: true, tempPassword };
}

export async function deactivateAccountAction(cohortId: number, targetUserId: number) {
  await requireCohortAccess(cohortId, "account:manage");

  await db.user.update({
    where: { id: targetUserId },
    data: { status: ActiveStatus.INACTIVE },
  });

  // 해당 계정의 활성 세션 모두 삭제
  await db.authSession.deleteMany({
    where: { userId: targetUserId },
  });

  return { success: true };
}
