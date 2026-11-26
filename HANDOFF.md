# HANDOFF — lms-dx-web (lms_kdt)
갱신: 2026-11-26 16:05 (KST) · PC: DESKTOP-D7TTIN2 · 브랜치: main

## 목표
매니저 계정을 포함한 담당 구조와 UI/UX 개선 (아래 1~3 전부). 사용자가 범위를 정했다.

## 현재 상태
- 완료: T6 챗봇 실제 연동 (커밋 82453fa, 완료 기록 69ef0ff). 로컬에서 호출·화면 시험 정상(화면은 사용자 확인). 스테이징에는 마이그레이션 `20261126150000_m4_chatbot_service_link`와 코드가 미적용.
- 완료: 매니저 구조·화면 현황 점검(코드·설계 문서 기준, 화면은 직접 보지 않음)과 아래 계획 작성.
- 시작 전: 계획의 코드 변경. 새 세션에서 이 계획대로 진행하기로 했다.
- push 안 한 로컬 커밋이 있다 (이 인수인계 커밋 포함 8개).

## 점검에서 확인한 것
- 한 교직원의 여러 반 배정은 DB 구조(`CohortStaff`)·PRD·반 전환·`/app/overview`가 지원한다.
- 교직원 배정은 반 개설과 새 계정 발급 때만 된다. 기존 교직원을 기존 반에 추가·해제하거나 주담당을 바꾸는 기능은 찾지 못했다.
- 계정 발급으로 만든 매니저는 주담당이 아니다. 티켓 담당자는 주담당 매니저만 지정되고, 없으면 비어 학원 관리자가 처리한다.
- 반 전환은 항상 반 홈으로 간다 (`ia.md` §2는 같은 메뉴 위치 유지).
- `/app/overview`는 왼쪽 메뉴에서 갈 수 없고, 요약 카드는 반 홈으로만 간다.
- 챗봇 매뉴얼·반 설정은 명부 화면 우상단 버튼으로만 들어간다.
- 시드의 `mgr_a`, `mgr_b`는 반이 하나씩이라 반 전환이 보이지 않는다.

## 다음 할 일 (우선순위 순)
계획 (사용자가 "1~3 전부 계획"으로 범위를 정한 뒤 제시. 구현 시작 승인은 새 세션에서 한 번 확인한다)
1. 교직원 배정: 계정 관리 화면에 "담당 교직원" 영역. 같은 학원의 기존 매니저·강사 추가·해제, 주담당(반당 매니저 1명) 변경. 권한 `account:manage`, 대상의 학원·역할은 서버에서 검사.
2. 담당 해제 시: 그 사람에게 배정된 미완료 티켓(`assigneeId`)은 새 주담당에게, 없으면 비움. (에이전트 권장안, 이견은 아직 없음)
3. 반 이동: 전환 때 보던 메뉴 유지, 전환 목록에 "담당 반" 요약 추가, 요약 카드의 위험 인원·대기 티켓·출결 미확인은 해당 화면으로 연결.
4. 메뉴: 매니저 `명부` → `반 관리`, 상단 전환(`SectionSwitch`)으로 명부·챗봇 매뉴얼·반 설정. 학원 관리자도 같음. 강사·수강생은 그대로. 메뉴 5개 이내 유지.
5. 문서(`ia.md`, `screens.md`, `permissions.md`, `PROGRESS.md`) 갱신. 테스트는 필수 3종 안에서 배정 권한·학원 범위 사례만 추가.
6. 교직원 배정 → 반 이동 → 메뉴 순으로 나눠 로컬 커밋. push는 하지 않는다. 화면 확인은 사용자.

## 결정 사항
- 새 DB 스키마 변경·새 의존성은 필요 없다고 봄 (추정, `isPrimary`·`assigneeId`는 이미 있음).
- 매니저 권한 자체(예: 계정 발급 허용)는 바꾸지 않는 안이다. 사용자가 원하면 다시 정한다.

## 주의 · 막힌 점
- `docs/sync-status.md` 9장의 T1~T5와 D2~D5는 요청받지 않았다. 임의로 시작하지 않는다.
- `docs/ai-integration.md` 3.2의 파일 크기 항목과 4절(면접 질문 HTTP 규격)은 갱신 전이다.
- `.env`는 사람이 관리한다. 로컬 챗봇 연동에는 챗봇 서비스가 켜져 있어야 한다.
- 형제 저장소 `../chatbot`에도 push 안 한 문서 커밋이 1개 있다 (챗봇 담당자용 질문).
- 이 세션에서 켠 개발 서버가 남아 있을 수 있다.

## 핵심 파일
- `src/server/academy.ts` — 반 개설·계정 발급 (`bulkIssueAccountsAction`)
- `src/server/academy-queries.ts` — `getCohortAccounts`, `listOverviewCohorts`
- `src/app/app/academy/cohorts/[cohortId]/accounts/` — 계정 관리 화면
- `src/server/tickets.ts` — `primaryManagerId`
- `src/components/shell/nav.ts` — 역할별 메뉴 (`cohortNav`)
- `src/components/shell/AppShell.tsx` — `CohortSwitcher`
- `src/components/shell/SectionSwitch.tsx` — 상단 전환 탭
- `src/app/app/overview/page.tsx` — 담당 반 요약
- `src/app/app/c/[cohortId]/members|chatbot-docs|settings/` — 반 관리로 묶을 화면

## 확인 방법
- `npm run lint` · `npx tsc --noEmit` · `npx vitest run` (2026-11-26 T6 시점에 모두 통과, 252개)
- 개발 서버: `.claude/launch.json`의 `dev`
