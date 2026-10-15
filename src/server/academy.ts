"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Role, StaffRole, EnrollmentStatus, ActiveStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuthUser } from "@/lib/auth/session";
import { requireCohortAccess } from "@/lib/access/requireCohortAccess";
import { parseRosterCSV, type ParsedAccountRow } from "@/lib/csv";

function generateTempPassword(length = 10): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$";
  let result = "";
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
}

export async function createCohortAction(prevState: unknown, formData: FormData) {
  const user = await requireAuthUser();
  if (user.role !== Role.ACADEMY_ADMIN && user.role !== Role.ADMIN) {
    return { error: "반 개설 권한이 없습니다." };
  }

  const name = formData.get("name") as string;
  const trainingType = (formData.get("trainingType") as string) || "K-Digital Training";
  const room = formData.get("room") as string;
  const startDateStr = formData.get("startDate") as string;
  const endDateStr = formData.get("endDate") as string;

  if (!name || !startDateStr || !endDateStr) {
    return { error: "과정명, 시작일, 종료일은 필수입니다." };
  }

  const startDate = new Date(`${startDateStr}T00:00:00Z`);
  const endDate = new Date(`${endDateStr}T00:00:00Z`);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return { error: "올바른 날짜 형식이 아닙니다." };
  }

  const academyId = user.academyId ?? 1;

  // 기본 주중 훈련시간 (월~목 09:00~17:40, 금 09:00~16:40)
  const defaultWeeklySchedule = {
    "1": ["09:00", "17:40"],
    "2": ["09:00", "17:40"],
    "3": ["09:00", "17:40"],
    "4": ["09:00", "17:40"],
    "5": ["09:00", "16:40"],
  };

  const cohort = await db.cohort.create({
    data: {
      academyId,
      name,
      trainingType,
      room: room || null,
      startDate,
      endDate,
      weeklySchedule: defaultWeeklySchedule,
      holidays: [],
      attendanceConfig: {
        requiredPercent: 80,
        lateEarlyToAbsent: 3,
        combineLateEarly: true,
        outCounts: "IGNORE",
        excused: { limit: null, scope: "PERIOD", overflow: "COUNT_AS_ABSENT" },
        grade: { normalMinRemaining: 2, warnMinRemaining: 1 },
      },
    },
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
