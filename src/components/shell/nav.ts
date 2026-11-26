// 역할별 메뉴 정의(docs/design/ia.md §2). 메뉴를 바꿀 때는 여기만 고친다.
import { Role } from "@prisma/client";
import type { NavItem } from "./AppShell";

/** 역할 표시 이름 */
export const ROLE_LABELS: Record<Role, string> = {
  STUDENT: "수강생",
  INSTRUCTOR: "강사",
  MANAGER: "서브 관리자",
  ACADEMY_ADMIN: "슈퍼어드민",
  ADMIN: "시스템 관리자",
};

const ACADEMY_HOME: NavItem = { label: "학원 홈", href: "/app/academy", icon: "academy", exact: true };

/** 학원 관리 화면 메뉴. 서브 계정은 슈퍼어드민만, 학원 문서는 슈퍼어드민·시스템 관리자만(서버에서도 다시 검사). */
export function academyNav(role: Role): NavItem[] {
  const items: NavItem[] = [ACADEMY_HOME, { label: "반 개설", href: "/app/academy/cohorts/new", icon: "newCohort" }];
  if (role === Role.ACADEMY_ADMIN) items.push({ label: "서브 계정", href: "/app/academy/sub-accounts", icon: "accounts" });
  if (role === Role.ACADEMY_ADMIN || role === Role.ADMIN) items.push({ label: "학원 문서", href: "/app/academy/chatbot-docs", icon: "documents" });
  return items;
}

/** ia.md §2 역할별 메뉴. */
export function cohortNav(role: Role, cohortId: number): NavItem[] {
  const c = `/app/c/${cohortId}`;
  const home: NavItem = { label: "홈", href: c, icon: "home", exact: true };
  const attendance: NavItem = { label: "출결", href: `${c}/attendance`, icon: "attendance" };
  const tickets: NavItem = { label: "티켓", href: `${c}/tickets`, icon: "tickets" };
  // 명부·반 설정은 한 메뉴로 묶고 화면 상단 전환으로 오간다
  const manage: NavItem = { label: "반 관리", href: `${c}/members`, icon: "members", alsoMatch: [`${c}/settings`] };
  const documents: NavItem = { label: "서류", href: `${c}/resume`, icon: "documents" };
  // 메뉴 5개 이내: 교직원은 서류와 팀 프로젝트를 한 메뉴로 묶고 화면 상단 전환으로 오간다
  const career: NavItem = { label: "서류·프로젝트", href: `${c}/resume`, icon: "career", alsoMatch: [`${c}/team`, `${c}/leads`] };
  const team: NavItem = { label: "팀 프로젝트", href: `${c}/team`, icon: "team" };
  const interview: NavItem = { label: "면접", href: `${c}/interview`, icon: "interview" };

  switch (role) {
    case Role.STUDENT:
      // 모바일 하단 탭은 앞 4개 + 더보기 (AppShell)
      return [home, attendance, tickets, { label: "자료·과제", href: `${c}/curriculum`, icon: "curriculum" }, { ...documents, label: "내 서류" }, team, interview];
    case Role.INSTRUCTOR:
      return [home, { label: "수업·자료", href: `${c}/curriculum`, icon: "curriculum" }, attendance, tickets, career];
    // 서브 관리자는 슈퍼어드민과 같은 반 메뉴를 쓴다
    case Role.MANAGER:
    case Role.ACADEMY_ADMIN:
    case Role.ADMIN:
      return [
        ACADEMY_HOME,
        home,
        attendance,
        tickets,
        manage,
        career,
        { label: "계정 관리", href: `/app/academy/cohorts/${cohortId}/accounts`, icon: "accounts" },
      ];
  }
}
