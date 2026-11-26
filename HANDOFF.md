# HANDOFF — lms-dx-web (lms_kdt)
갱신: 2026-11-26 16:15 (KST) · PC: DESKTOP-D7TTIN2 · 브랜치: main

## 목표
매니저 계정을 포함한 담당 구조와 UI/UX 개선 (1~3). 코드 구현은 끝났고 화면 확인이 남았다.

## 현재 상태
- 완료: 담당 교직원 배정·해제·주담당 변경 (커밋 0d16f9e)
- 완료: 반 전환 시 같은 메뉴 유지, `담당 반 요약` 링크, 요약 항목 바로가기 (커밋 4470072)
- 완료: 매니저 메뉴 `반 관리`(명부·반 설정), 설계 문서·PROGRESS 갱신 (커밋 01ab97d)
- 완료: 교직원 계정 비활성화 시 주담당 해제·미완료 티켓 인계, 담당자는 활성 주담당만 지정
- 완료: 챗봇 학원 공통 문서를 `/app/academy/chatbot-docs`(학원 문서)로 분리, 반 화면은 반 문서만 관리
- 완료(위 항목을 대체): 반 `챗봇 매뉴얼` 화면·반 문서 기능·`chatDoc:manage` 권한 삭제, 챗봇 문서는 학원 공통만
- lint·tsc·vitest(259개) 통과. 로그인 후 화면은 확인하지 않았다.
- T6 챗봇 실제 연동은 로컬 완료. 스테이징에는 마이그레이션 `20261126150000_m4_chatbot_service_link`와 코드가 미적용.
- push 안 한 로컬 커밋이 있다.

## 다음 할 일 (우선순위 순)
1. 사용자 화면 확인: 학원 관리자로 계정 관리에서 `mgr_a`를 반 B에도 배정 → `mgr_a`로 로그인해 반 전환, 담당 반 요약 바로가기, `반 관리` 상단 전환 확인 → 담당 해제·주담당 계정 비활성화 후 티켓 담당자 확인.
2. 사용자 화면 확인: 학원 관리자의 `학원 문서` 등록·삭제·열기, `반 관리` 상단 전환이 명부 / 반 설정만 보이는지.

## 결정 사항
- 담당 해제 시 미완료 티켓은 남은 주담당에게, 없으면 비움. 주담당 본인을 해제하면 비운다(자동 승격 없음).
- 담당 반 요약 링크는 강사·매니저의 반 전환 목록에만 둔다.
- DB 스키마 변경·새 의존성 없음.

## 주의 · 막힌 점
- 이 수정 전에 비활성화된 계정에 이미 배정된 미완료 티켓은 옮기지 않았다.
- `docs/sync-status.md` 9장의 T1~T5와 D2~D5는 요청받지 않았다. 임의로 시작하지 않는다.
- `docs/ai-integration.md` 3.2의 파일 크기 항목과 4절(면접 질문 HTTP 규격)은 갱신 전이다.
- `.env`는 사람이 관리한다. 로컬 챗봇 연동에는 챗봇 서비스가 켜져 있어야 한다.
- 형제 저장소 `../chatbot`에도 push 안 한 문서 커밋이 1개 있다.

## 핵심 파일
- `src/server/academy.ts` — `assignStaffAction`, `removeStaffAction`, `setPrimaryManagerAction`
- `src/app/app/academy/cohorts/[cohortId]/accounts/staff-manager.tsx` — 담당 교직원 화면
- `src/lib/access/checker.ts` — `canAssignCohortStaffPure`, `canManageAcademyChatDocsPure`
- `src/components/chatbot/ChatDocsManager.tsx` — 학원 문서 화면 부품
- `src/components/shell/AppShell.tsx` — `CohortSwitcher`, `switchCohortHref`
- `src/components/shell/nav.ts`, `SectionSwitch.tsx`(`manageSections`) — 메뉴
- `src/app/app/overview/page.tsx` — 담당 반 요약

## 확인 방법
- `npm run lint` · `npx tsc --noEmit` · `npx vitest run`
- 개발 서버: `.claude/launch.json`의 `dev`
