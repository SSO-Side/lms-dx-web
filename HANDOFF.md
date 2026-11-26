# HANDOFF — lms-dx-web (lms_kdt)
갱신: 2026-11-26 17:39 (KST) · PC: DESKTOP-D7TTIN2 · 브랜치: main

## 목표
매니저 계정을 포함한 담당 구조·UI 개선(1~3)과 챗봇 문서 구조 정리. 코드는 끝났고 사용자 화면 확인이 남았다.

## 현재 상태
- 완료: 계정 관리의 담당 교직원 배정·해제·주담당 변경 (커밋 0d16f9e)
- 완료: 반 전환 시 같은 메뉴 유지, `담당 반 요약` 링크, 요약 항목 바로가기 (커밋 4470072)
- 완료: 매니저 메뉴 `명부` → `반 관리` (커밋 01ab97d)
- 완료: 교직원 계정 비활성화 시 주담당 해제·미완료 티켓 인계, 담당자는 활성 주담당만 (커밋 7dbde19)
- 완료: 챗봇 문서는 학원 공통만 사용. `/app/academy/chatbot-docs`(학원 문서)에서만 관리하고, 반 `챗봇 매뉴얼` 화면·반 문서 기능·`chatDoc:manage` 권한은 삭제 (커밋 3c3a64f → 7a29fb3). `반 관리` 탭은 명부 / 반 설정.
- 2026-11-26 17:33 기준 lint·tsc·vitest(259개) 통과. 로그인 후 동작은 에이전트가 확인하지 않았다. 사용자는 매니저 홈 화면에서 `반 관리` 메뉴를 본 것까지 확인(탭 제거 전).
- 개발 DB의 챗봇 문서는 학원 공통 1건, 반 문서 0건.
- T6 챗봇 실제 연동은 로컬 완료. 스테이징에는 마이그레이션 `20261126150000_m4_chatbot_service_link`와 코드가 미적용(스테이징 문서 데이터는 확인하지 않음).
- push 안 한 로컬 커밋이 있다 (이 인수인계 커밋 포함 16개).

## 다음 할 일 (우선순위 순)
1. 사용자 화면 확인 (담당 구조): 학원 관리자로 계정 관리에서 `mgr_a`를 반 B에도 배정 → `mgr_a`로 반 전환, 담당 반 요약 바로가기, `반 관리` 탭(명부 / 반 설정) 확인 → 담당 해제·주담당 계정 비활성화 후 티켓 담당자 확인. 비활성화한 계정을 다시 켜는 기능은 보지 못했으니 시험용 가상 계정으로 한다.
2. 사용자 화면 확인 (학원 문서): `acad_admin`의 `학원 문서`에서 기존 문서 열기, 가상 PDF 등록·삭제. 실제 연동은 챗봇 서비스가 켜져 있어야 한다.

## 결정 사항
- 담당 해제 시 미완료 티켓은 남은 주담당에게, 없으면 비움. 주담당 본인을 해제하면 비운다(자동 승격 없음).
- 교직원 계정 비활성화는 맡은 모든 반의 주담당을 풀고 티켓을 넘긴다. 담당 배정은 남긴다.
- 담당 반 요약 링크는 강사·매니저의 반 전환 목록에만 둔다.
- 챗봇 문서는 학원 공통만 — 이유: 사용자가 학원 문서는 반별로 두는 것이 아니라고 판단. 매니저는 문서를 관리하지 않는다.
- 학원에 속하지 않은 시스템 관리자(ADMIN)는 학원 문서를 관리할 수 없다.
- DB 스키마 변경·새 의존성 없음. `ChatbotDocument.cohortId` 컬럼은 남기고 새 문서는 항상 null.

## 주의 · 막힌 점
- 7dbde19 이전에 비활성화한 계정에 이미 배정된 미완료 티켓은 옮기지 않았다.
- 스테이징 반영 때 반 번호가 있는 챗봇 문서가 있는지 먼저 확인한다. 있으면 화면에서 지울 수 없는데 챗봇 서비스에는 남는다.
- 담당 반 요약의 `대기 티켓` 수는 대기+검토 중 합계인데, 누르면 `대기` 탭이 열린다.
- `docs/sync-status.md` 9장의 T1~T5와 D2~D5는 요청받지 않았다. 임의로 시작하지 않는다.
- `docs/ai-integration.md` 3.2의 파일 크기 항목과 4절(면접 질문 HTTP 규격)은 갱신 전이다.
- `.env`는 사람이 관리한다.
- 형제 저장소 `../chatbot`에도 push 안 한 커밋이 1개 있다.
- 개발 서버(포트 3333)가 켜져 있을 수 있다. 켜진 채로 `next build`를 하지 않는다.

## 핵심 파일
- `src/server/academy.ts` — `assignStaffAction`, `removeStaffAction`, `setPrimaryManagerAction`, `handOffOpenTickets`, `deactivateAccountAction`
- `src/server/cohort-queries.ts` — `findActivePrimaryManagerId`
- `src/app/app/academy/cohorts/[cohortId]/accounts/staff-manager.tsx` — 담당 교직원 화면
- `src/lib/access/checker.ts` — `canAssignCohortStaffPure`, `canManageAcademyChatDocsPure`
- `src/components/shell/` — `AppShell.tsx`(`CohortSwitcher`, `switchCohortHref`), `nav.ts`, `SectionSwitch.tsx`(`manageSections`)
- `src/app/app/overview/page.tsx` — 담당 반 요약
- `src/app/app/academy/chatbot-docs/page.tsx`, `src/components/chatbot/ChatDocsManager.tsx` — 학원 문서 화면
- `src/server/chatbot.ts`, `chatbot-queries.ts`, `chatbot-sync.ts` — 챗봇 질문·학원 문서

## 확인 방법
- `npm run lint` · `npx tsc --noEmit` · `npx vitest run`
- 개발 서버: `.claude/launch.json`의 `dev`
