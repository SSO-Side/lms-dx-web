# HANDOFF — lms-dx-web (lms_kdt)
갱신: 2026-11-26 18:45 (KST) · PC: DESKTOP-D7TTIN2 · 브랜치: main

## 목표
매니저·학원 관리자를 슈퍼어드민 1명 + 서브 관리자 여러 명 구조로 합치고, 관리자 첫 화면을 학원 전체 대시보드로 바꾼다. 코드는 끝났고 사용자 화면 확인이 남았다.

## 현재 상태
- 완료: 병합 + 전체 대시보드 (커밋 263b2e1). DB 스키마 변경·새 의존성 없음.
  - MANAGER = 서브 관리자: 배정과 무관하게 같은 학원 전체 반, 동작 권한은 ACADEMY_ADMIN과 같음(`account:manage` 포함 — 반 개설·반 설정·수강생/강사 계정·담당 배정).
  - 슈퍼어드민 전용: 서브 계정 발급·재설정·비활성화(`/app/academy/sub-accounts`), 학원 문서.
  - 반 명부 CSV는 STUDENT·INSTRUCTOR만. 반 계정 관리 화면의 서브 관리자 행은 버튼 없이 "서브 계정에서 관리".
  - 관리자(슈퍼·서브·ADMIN)는 로그인하면 `/app/academy`로 감. 요약 숫자 5개, 전체 반 처리 대기 티켓·위험 학생, 반별 현황 표. `/app/overview`는 강사만.
  - 역할 표시: ACADEMY_ADMIN "슈퍼어드민", MANAGER "서브 관리자".
- lint·tsc·vitest(290개) 통과. 로그인 후 화면은 에이전트가 확인하지 않았다(브라우저 접근이 자동 권한 분류기에 막힘, 시드 비밀번호는 사람이 관리).
- 이전 작업(담당 구조·학원 문서)의 화면 확인도 아직 남아 있다.
- 로컬 커밋은 모두 origin/main에 push했다 (2026-11-26, 이 인수인계 커밋 포함).

## 다음 할 일 (우선순위 순)
아래 1~3은 모두 [사용자 작업]이다 (로그인 후 눈으로 확인, 시드 비밀번호는 사람이 관리). 에이전트는 개발 서버 실행까지만 돕는다.
1. 사용자 화면 확인 (병합): `acad_admin`으로 로그인 → 학원 홈 대시보드 숫자·위젯 → `서브 계정`에서 시험용 가상 서브 관리자 발급 → 그 계정으로 로그인(비밀번호 변경) → 학원 홈으로 가는지, 배정 안 된 반 B도 열리는지, `서브 계정`·`학원 문서` 메뉴가 안 보이는지, 반 개설·반 설정 저장이 되는지.
2. `mgr_a`로 로그인해 같은 확인. 반 계정 관리에서 서브 관리자 행에 버튼이 없는지.
3. 이전 작업 확인: 담당 교직원 배정·주담당·비활성화 후 티켓 담당자, `학원 문서` 등록·삭제.
4. 확인 중 문제가 나오면 증상(계정·화면 경로·기대와 실제)을 적어 새 세션에 넘긴다.
5. (다음 주) main push 자동 배포. 초안은 커밋 b086c43(되돌림 8861ccf)에 있다: `.github/workflows/deploy.yml` + user-tasks 3-0 9번 Secrets 안내. `git revert 8861ccf`로 되살린 뒤 Secrets 등록하고 push. 마이그레이션 자동 적용은 사용자 결정.

## 팀원 로컬 실행
- 빈 PC 기준 안내는 `docs/setup-guide.md` (Node 22, 각자 Docker MariaDB, `.env` 3개 키, migrate → generate → seed → dev). 계정·역할은 `README.md` 1·2절 (2026-11-26 슈퍼어드민·서브 관리자 기준으로 갱신).

## 사용자 작업 체크리스트 [사용자 작업]
- [ ] 위 1~3 화면 확인
- [ ] 형제 저장소 `../chatbot`의 미푸시 커밋 1개 push
- [ ] 스테이징 반영 전: 반 번호가 있는 챗봇 문서 존재 여부 확인 후 T6 마이그레이션 적용 (`migrate deploy`는 사람이 실행)

## 결정 사항
- 서브 관리자 범위는 학원 전체 반 — 이유: 사용자 선택, 전체 대시보드와 맞춤. `CohortStaff`의 매니저 배정은 주담당(티켓 자동 배정)에만 씀.
- 슈퍼어드민 전용은 서브 계정 관리·학원 문서만 — 이유: 사용자 선택. 반 개설·반 설정·수강생/강사 계정은 서브도 가능.
- DB 역할 값 MANAGER 유지, 이름만 서브 관리자 — 이유: 사용자 선택, 마이그레이션 불필요.
- 학원당 슈퍼어드민 1명은 코드로 강제하지 않음 — 이유: ACADEMY_ADMIN 발급 화면이 없고 시드로만 만든다(`/admin` 화면은 존재하지 않음).
- 서브 계정 재활성화 기능은 만들지 않음 (요청 범위 밖).
- 티켓 인계(`handOffOpenTickets`, `deactivateUserWithHandOff`)는 `src/server/staff-handoff.ts`로 옮김 — "use server" 파일에서 export하면 권한 검사 없이 클라이언트가 부를 수 있기 때문.

## 주의 · 막힌 점
- 강사(INSTRUCTOR)는 여전히 배정된 반만 본다. 학생용 문구의 "담당 매니저"는 그대로 둠.
- 7dbde19 이전에 비활성화한 계정에 이미 배정된 미완료 티켓은 옮기지 않았다.
- 스테이징 반영 때 반 번호가 있는 챗봇 문서가 있는지 먼저 확인한다(T6 마이그레이션 `20261126150000_m4_chatbot_service_link` 미적용).
- `docs/sync-status.md` 9장의 T1~T5와 D2~D5는 요청받지 않았다. 임의로 시작하지 않는다.
- `.env`는 사람이 관리한다. 개발 서버(포트 3333)가 켜져 있을 수 있다. 켜진 채로 `next build`를 하지 않는다.
- 형제 저장소 `../chatbot`에도 push 안 한 커밋이 1개 있다.

## 핵심 파일
- `src/lib/access/checker.ts` — `canAccessCohortPure`(서브 관리자 학원 범위), `canManageSubAccountsPure`, `isAcademyStaffRole`, `canManageCohortAccountPure`
- `src/lib/access/permissions.ts` — 권한표 (`account:manage` MANAGER 허용)
- `src/server/sub-accounts.ts` — 서브 계정 발급·재설정·비활성화 액션
- `src/server/staff-handoff.ts` — 티켓 인계·비활성화 공통 처리 (서버 액션 아님)
- `src/server/dashboard-queries.ts` — `getAcademyDashboard`, `listAcademyPendingTickets`
- `src/app/app/academy/page.tsx`, `src/components/widgets/AcademyWidgets.tsx` — 학원 전체 대시보드
- `src/app/app/academy/sub-accounts/` — 서브 계정 화면
- `src/components/shell/nav.ts` — 역할 라벨, `academyNav(role)`, `cohortNav`
- `tests/cohort-isolation.test.ts`, `tests/permissions-matrix.test.ts` — 서브 관리자 범위·서브=슈퍼 권한 동일성

## 확인 방법
- `npm run lint` · `npx tsc --noEmit` · `npx vitest run`
- 개발 서버: `.claude/launch.json`의 `dev`
