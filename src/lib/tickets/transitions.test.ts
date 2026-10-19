// 필수 테스트(티켓 전이): 허용 전이는 전이표에서, 불허 전이는 모든 조합을 자동 생성해 검사한다.
import { describe, it, expect } from "vitest";
import { Role, TicketStatus } from "@prisma/client";
import { canTransition, TRANSITIONS } from "./transitions";

const STATUSES = Object.values(TicketStatus);
const ROLES = Object.values(Role);

describe("허용 전이 (ticket-state.md 전이표)", () => {
  it.each(TRANSITIONS.flatMap((r) => r.roles.map((role) => ({ ...r, role }))))("$from → $to by $role", (r) => {
    expect(canTransition(r.from, r.to, r.role, { isRequester: true, comment: "사유" })).toEqual({ ok: true });
  });

  it.each(TRANSITIONS.filter((r) => r.commentRequired))("$from → $to 는 comment 필수", (r) => {
    expect(canTransition(r.from, r.to, r.roles[0], { isRequester: true, comment: " " }).ok).toBe(false);
  });

  it.each(TRANSITIONS.filter((r) => r.requesterOnly))("$from → $to 는 요청자 본인만", (r) => {
    expect(canTransition(r.from, r.to, r.roles[0], { isRequester: false, comment: "x" }).ok).toBe(false);
  });
});

describe("불허 전이 (표에 없는 모든 조합 자동 생성)", () => {
  const disallowed = STATUSES.flatMap((from) =>
    STATUSES.flatMap((to) =>
      ROLES.filter((role) => role !== "ADMIN")
        .filter((role) => !TRANSITIONS.some((r) => r.from === from && r.to === to && r.roles.includes(role)))
        .map((role) => ({ from, to, role }))
    )
  );

  it("조합 수 확인", () => expect(disallowed.length).toBeGreaterThan(100));

  it.each(disallowed)("$from → $to by $role 거부", ({ from, to, role }) => {
    expect(canTransition(from, to, role, { isRequester: true, comment: "사유" }).ok).toBe(false);
  });

  it.each(STATUSES.flatMap((from) => STATUSES.filter((to) => !TRANSITIONS.some((r) => r.from === from && r.to === to)).map((to) => ({ from, to }))))(
    "ADMIN도 표에 없는 $from → $to 거부",
    ({ from, to }) => {
      expect(canTransition(from, to, "ADMIN", { isRequester: false, comment: "x" }).ok).toBe(false);
    }
  );
});
