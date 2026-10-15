import { Role } from "@prisma/client";
import type { NavItem } from "./AppShell";

export const ROLE_LABELS: Record<Role, string> = {
  STUDENT: "수강생",
  INSTRUCTOR: "강사",
  MANAGER: "매니저",
  ACADEMY_ADMIN: "학원 관리자",
  ADMIN: "시스템 관리자",
};

const ACADEMY_NAV: NavItem[] = [
  { label: "학원 홈", href: "/app/academy", icon: "academy", exact: true },
  { label: "반 개설", href: "/app/academy/cohorts/new", icon: "newCohort" },
];

export function academyNav(): NavItem[] {
  return ACADEMY_NAV;
}

/** ia.md §2 역할별 메뉴. */
export function cohortNav(role: Role, cohortId: number): NavItem[] {
  const c = `/app/c/${cohortId}`;
  const home: NavItem = { label: "홈", href: c, icon: "home", exact: true };
  const attendance: NavItem = { label: "출결", href: `${c}/attendance`, icon: "attendance" };
  const tickets: NavItem = { label: "티켓", href: `${c}/tickets`, icon: "tickets" };
  const members: NavItem = { label: "명부", href: `${c}/members`, icon: "members" };
  const settings: NavItem = { label: "반 설정", href: `${c}/settings`, icon: "settings" };

  switch (role) {
    case Role.STUDENT:
      return [home, attendance, tickets, { label: "자료·과제", href: `${c}/curriculum`, icon: "curriculum" }];
    case Role.INSTRUCTOR:
      return [home, { label: "수업·자료", href: `${c}/curriculum`, icon: "curriculum" }, attendance, tickets];
    case Role.MANAGER:
      return [home, attendance, tickets, members, settings];
    case Role.ACADEMY_ADMIN:
    case Role.ADMIN:
      return [
        ACADEMY_NAV[0],
        home,
        attendance,
        tickets,
        members,
        settings,
        { label: "계정 관리", href: `/app/academy/cohorts/${cohortId}/accounts`, icon: "accounts" },
      ];
  }
}
