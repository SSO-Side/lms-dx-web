"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "@base-ui/react/menu";
import {
  Home,
  CalendarCheck,
  Ticket,
  BookOpen,
  Users,
  Settings,
  Building2,
  UserCog,
  LayoutGrid,
  PlusCircle,
  ChevronDown,
  Check,
  KeyRound,
  LogOut,
  FileText,
  Ellipsis,
  type LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody } from "@/components/ui/sheet";
import { logoutAction } from "@/server/auth";
import { cn } from "@/lib/utils";

const ICONS = {
  home: Home,
  attendance: CalendarCheck,
  tickets: Ticket,
  curriculum: BookOpen,
  members: Users,
  settings: Settings,
  academy: Building2,
  accounts: UserCog,
  overview: LayoutGrid,
  newCohort: PlusCircle,
  documents: FileText,
} satisfies Record<string, LucideIcon>;

export type NavIcon = keyof typeof ICONS;

export interface NavItem {
  label: string;
  href: string;
  icon: NavIcon;
  /** false면 후속 모듈 준비 중으로 비활성 표시 */
  available?: boolean;
  /** true면 경로가 정확히 같을 때만 활성 */
  exact?: boolean;
}

export interface AppShellProps {
  title: string;
  subtitle?: string;
  nav: NavItem[];
  user: { name: string; roleLabel: string };
  cohorts?: Array<{ id: number; name: string }>;
  currentCohortId?: number;
  /** 수강생: 모바일 하단 탭바, 여유 밀도 */
  studentMode?: boolean;
  children: React.ReactNode;
}

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AppShell({
  title,
  subtitle,
  nav,
  user,
  cohorts = [],
  currentCohortId,
  studentMode = false,
  children,
}: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className={cn("min-h-dvh bg-background", studentMode && "text-base")}>
      {/* 데스크톱 사이드바 */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-neutral-200 bg-sidebar lg:flex">
        <div className="flex h-14 items-center border-b border-neutral-200 px-5">
          <Link href="/app" className="text-base font-semibold text-primary-700">
            lms_kdt
          </Link>
        </div>
        <nav aria-label="주 메뉴" className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {nav.map((item) => (
            <SideNavLink key={item.href + item.label} item={item} active={isActive(pathname, item)} />
          ))}
        </nav>
      </aside>

      <div className="flex min-h-dvh flex-col lg:pl-60">
        {/* 상단 바 */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-neutral-200 bg-card px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Link href="/app" className="text-base font-semibold text-primary-700 lg:hidden">
              lms_kdt
            </Link>
            <span className="text-neutral-300 lg:hidden" aria-hidden>
              /
            </span>
            {cohorts.length >= 2 && currentCohortId ? (
              <CohortSwitcher title={title} cohorts={cohorts} currentCohortId={currentCohortId} />
            ) : (
              <div className="min-w-0">
                <p className="truncate font-semibold text-neutral-900">{title}</p>
              </div>
            )}
            {subtitle && <span className="hidden truncate text-xs text-neutral-500 md:inline">{subtitle}</span>}
          </div>
          <UserMenu user={user} />
        </header>

        {/* 태블릿·모바일 상단 메뉴 (교사·매니저용, 수강생은 하단 탭바) */}
        {!studentMode && (
          <nav aria-label="주 메뉴" className="flex gap-1 overflow-x-auto border-b border-neutral-200 bg-card px-2 lg:hidden">
            {nav.map((item) => {
              const active = isActive(pathname, item);
              const Icon = ICONS[item.icon];
              if (item.available === false) {
                return (
                  <span key={item.href + item.label} className="flex h-11 shrink-0 items-center gap-1.5 px-3 text-sm text-neutral-400" aria-disabled>
                    <Icon className="size-4" aria-hidden />
                    {item.label}
                  </span>
                );
              }
              return (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm",
                    active ? "border-primary-500 font-medium text-primary-700" : "border-transparent text-neutral-600"
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}

        <main className={cn("mx-auto w-full max-w-7xl flex-1 px-4 py-5 lg:px-6 lg:py-6", studentMode && "pb-24 lg:pb-6")}>
          {children}
        </main>
      </div>

      {/* 수강생 모바일 하단 탭바 (터치 영역 44px 이상). 5개 이상이면 앞 4개 + 더보기 드로어 */}
      {studentMode && <StudentTabBar nav={nav} pathname={pathname} />}
    </div>
  );
}

const TAB_LIMIT = 4;

function StudentTabBar({ nav, pathname }: { nav: NavItem[]; pathname: string }) {
  const [moreOpen, setMoreOpen] = React.useState(false);
  const tabs = nav.length > TAB_LIMIT ? nav.slice(0, TAB_LIMIT) : nav;
  const more = nav.slice(tabs.length);
  const moreActive = more.some((item) => isActive(pathname, item));
  const cols = tabs.length + (more.length > 0 ? 1 : 0);

  return (
    <>
      <nav
        aria-label="주 메뉴"
        className="fixed inset-x-0 bottom-0 z-30 grid border-t border-neutral-200 bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {tabs.map((item) => {
          const active = isActive(pathname, item);
          const Icon = ICONS[item.icon];
          const content = (
            <>
              <Icon className="size-5" aria-hidden />
              <span className="text-xs">{item.label}</span>
            </>
          );
          if (item.available === false) {
            return (
              <span key={item.href} className="flex h-16 flex-col items-center justify-center gap-1 text-neutral-400" aria-disabled>
                {content}
              </span>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn("flex h-16 flex-col items-center justify-center gap-1", active ? "font-medium text-primary-600" : "text-neutral-600")}
            >
              {content}
            </Link>
          );
        })}
        {more.length > 0 && (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            className={cn("flex h-16 flex-col items-center justify-center gap-1", moreActive ? "font-medium text-primary-600" : "text-neutral-600")}
          >
            <Ellipsis className="size-5" aria-hidden />
            <span className="text-xs">더보기</span>
          </button>
        )}
      </nav>
      {more.length > 0 && (
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetContent className="h-auto md:h-full">
            <SheetHeader>
              <SheetTitle>더보기</SheetTitle>
            </SheetHeader>
            <SheetBody className="pb-8">
              <ul className="space-y-1">
                {more.map((item) => {
                  const Icon = ICONS[item.icon];
                  const active = isActive(pathname, item);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMoreOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex min-h-12 items-center gap-3 rounded-lg px-3 text-base",
                          active ? "bg-primary-50 font-medium text-primary-700" : "text-neutral-800 hover:bg-neutral-50"
                        )}
                      >
                        <Icon className="size-5" aria-hidden />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </SheetBody>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}

function SideNavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = ICONS[item.icon];
  if (item.available === false) {
    return (
      <span
        className="flex h-10 items-center gap-3 rounded-md px-3 text-sm text-neutral-400"
        aria-disabled
        title="후속 모듈에서 제공됩니다"
      >
        <Icon className="size-4" aria-hidden />
        <span className="flex-1">{item.label}</span>
        <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500">준비 중</span>
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors duration-150",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-neutral-100 hover:text-neutral-900"
      )}
    >
      <Icon className="size-4" aria-hidden />
      {item.label}
    </Link>
  );
}

const popupClass =
  "min-w-48 rounded-lg border border-neutral-200 bg-popover p-1 text-sm shadow-lg outline-none transition duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0";
const itemClass =
  "flex h-9 cursor-default items-center gap-2 rounded-md px-2.5 text-neutral-700 outline-none select-none data-highlighted:bg-neutral-100 data-highlighted:text-neutral-900";

function CohortSwitcher({
  title,
  cohorts,
  currentCohortId,
}: {
  title: string;
  cohorts: Array<{ id: number; name: string }>;
  currentCohortId: number;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="반 전환"
        className="flex h-9 min-w-0 items-center gap-1.5 rounded-md px-2 font-semibold text-neutral-900 hover:bg-neutral-100"
      >
        <span className="truncate">{title}</span>
        <ChevronDown className="size-4 shrink-0 text-neutral-500" aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="start" className="z-50">
          <Menu.Popup className={popupClass}>
            <p className="px-2.5 py-1.5 text-xs text-neutral-500">반 전환</p>
            {cohorts.map((c) => (
              <Menu.LinkItem key={c.id} render={<Link href={`/app/c/${c.id}`} />} className={itemClass}>
                <Check className={cn("size-4", c.id === currentCohortId ? "text-primary-500" : "invisible")} aria-hidden />
                <span className="truncate">{c.name}</span>
              </Menu.LinkItem>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function UserMenu({ user }: { user: { name: string; roleLabel: string } }) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="사용자 메뉴"
        className="flex h-10 shrink-0 items-center gap-2 rounded-md px-2 hover:bg-neutral-100"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
          {user.name.slice(0, 1)}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm leading-tight font-medium text-neutral-900">{user.name}</span>
          <span className="block text-xs leading-tight text-neutral-500">{user.roleLabel}</span>
        </span>
        <ChevronDown className="hidden size-4 text-neutral-500 sm:block" aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="end" className="z-50">
          <Menu.Popup className={popupClass}>
            <div className="px-2.5 py-1.5 sm:hidden">
              <p className="font-medium text-neutral-900">{user.name}</p>
              <p className="text-xs text-neutral-500">{user.roleLabel}</p>
            </div>
            <Menu.LinkItem render={<Link href="/app/password" />} className={itemClass}>
              <KeyRound className="size-4" aria-hidden />
              비밀번호 변경
            </Menu.LinkItem>
            <Menu.Item onClick={() => void logoutAction()} className={itemClass}>
              <LogOut className="size-4" aria-hidden />
              로그아웃
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
