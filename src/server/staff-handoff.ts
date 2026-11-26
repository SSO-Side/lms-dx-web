// 교직원 담당 해제·계정 비활성화 때의 티켓 인계. 서버 액션이 아니다("use server" 없음) — 권한 확인을 마친 액션에서만 부른다.
import { ActiveStatus, type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { TERMINAL_STATUSES } from "@/lib/tickets/transitions";
import { findActivePrimaryManagerId } from "./cohort-queries";

/** 이 사람이 맡던 이 반의 미완료 티켓을 활성 주담당에게(없으면 담당자 없음) 넘기고 건수를 돌려준다. */
export async function handOffOpenTickets(tx: Prisma.TransactionClient, cohortId: number, fromUserId: number) {
  const primaryId = await findActivePrimaryManagerId(cohortId, tx);
  const moved = await tx.ticket.updateMany({
    where: { cohortId, assigneeId: fromUserId, status: { notIn: TERMINAL_STATUSES } },
    data: { assigneeId: primaryId },
  });
  return moved.count;
}

/**
 * 계정을 비활성화하고 세션을 지운다. 비활성화는 계정 전체에 걸리므로, 맡은 모든 반에서 주담당을 풀고
 * 미완료 티켓을 넘긴다(담당 배정은 남긴다).
 */
export async function deactivateUserWithHandOff(userId: number) {
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { status: ActiveStatus.INACTIVE } });
    await tx.authSession.deleteMany({ where: { userId } });

    const assignments = await tx.cohortStaff.findMany({ where: { userId }, select: { cohortId: true } });
    for (const { cohortId: staffCohortId } of assignments) {
      await tx.cohortStaff.updateMany({ where: { cohortId: staffCohortId, userId }, data: { isPrimary: false } });
      await handOffOpenTickets(tx, staffCohortId, userId);
    }
  });
}
