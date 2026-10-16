# 권한 명세 (M0 / RBAC)

구현 위치: `src/lib/access/` — `permissions.ts`(아래 표를 데이터로), `requireCohortAccess.ts`
테스트: 이 표를 **순회하는 표 기반 테스트 1개 파일** + 반 간 접근 차단 케이스(§3). 역할×액션 조합을 손으로 하나씩 쓰지 않는다.

## 1. 반 접근 범위 (`requireCohortAccess(cohortId, action)`)

| 역할 | 접근 가능한 반 |
| :-- | :-- |
| STUDENT | `Enrollment`가 ENROLLED인 본인 반 1개 |
| INSTRUCTOR, MANAGER | `CohortStaff`로 배정된 반 |
| ACADEMY_ADMIN | 자기 `academyId`에 속한 모든 반 (MANAGER와 같은 권한 + 계정·반·명부 관리) |
| ADMIN | 전체 (시스템 관리 콘솔 용도) |

처리 순서: ① 로그인·`status=ACTIVE`·`mustChangePassword` 확인 → ② 위 표로 반 접근 판정 → ③ 역할×액션 판정(§2) → ④ 통과 시 `ctx = { user, cohortId, role }` 반환. 하나라도 실패하면 403 (반의 존재 여부를 알려주지 않도록 존재하지 않는 반도 같은 응답).

## 2. 역할 × 액션 매트릭스 (O=허용, X=거부)

액션 키는 코드의 `Action` 유니온과 1:1로 맞춘다. 표의 권한은 §1로 접근 가능한 반 안에서만 유효하다.

| 액션 키 | STUDENT | INSTRUCTOR | MANAGER | ACADEMY_ADMIN | ADMIN |
| :-- | :-- | :-- | :-- | :-- | :-- |
| `material:read` / `assignment:read` | O | O | O | O | O |
| `material:write` / `assignment:write` | X | O | X | X | O |
| `submission:create` (본인 과제 제출) | O | X | X | X | O |
| `ticket:create` | O | X | X | X | O |
| `ticket:process` | X | O | O | O | O |
| `ticket:readOwn` | O | X | X | X | O |
| `ticket:readCohort` | X | O | O | O | O |
| `absenceProof:read` | 본인만 | X | O | O | O |
| `attendance:write` | X | X | O | O | O |
| `attendance:readCohort` | X | O | O | O | O |
| `attendance:readOwn` | O | X | X | X | O |
| `chat:ask` | O | O | O | O | O |
| `chatDoc:manage` | X | X | O | O | O |
| `resume:own` | O | X | X | X | O |
| `resume:readOthers` (M7 서류 현황) | X | 같은 반 수강생 | 상태만 | 상태만 | O |
| `resume:review` (M7 파일 열람·코멘트·상태 변경) | X | O (같은 반) | X | X | O |
| `team:feedback` (M5 팀 프로젝트 열람) | 본인 팀 | O | O | O | O |
| `team:manage` (M5 팀 생성·피드백·단계 승인·마일스톤 체크) | X | O (같은 반) | X | X | O |
| `team:write` (M5 본인 팀 기획안·체크·URL·주간 로그) | 본인 팀 | X | X | X | O |
| `showcase:apply·review·approve` (M10) | 신청(본인 팀) | 검토(같은 반) | 승인 | 승인 | O |
| `lead:read` (M10) | X | X | O | O | O |
| `account:manage` (계정 발급·반 개설·명부) | X | X | X | O | O |

- 지금 단계(M0~M3, M11)에서 구현하는 액션은 `material`~`attendance`, `chat`, `account`까지다. 나머지 행은 키와 값만 데이터에 두고 기능은 해당 모듈 작업 때 붙인다.
- M5: 팀 수정은 `canEditTeamProjectPure`(본인 팀·같은 반), 열람은 `canViewTeamProjectPure`(수강생은 본인 팀, 교직원은 반 전체)로 리소스 단위 검사한다. 매니저·슈퍼어드민은 열람만.
- M10: 쇼케이스 상태 전이는 `src/lib/showcase/transitions.ts` 전이표가 단일 기준. 공개 승인은 팀원 전원 동의 + 강사 검토가 있을 때만. 공개 영역(`/market`, `/api/market/*`, 리드 접수)은 반 권한의 예외로, PUBLISHED + 공개 DTO(`src/lib/showcase/public.ts`)로만 노출한다.
- M7: 강사 "배정된 수강생" 개념이 없어 "같은 반 수강생"으로 단순화했다. 서류 파일은 본인(`resume:own`)과 같은 반 강사(`resume:review`)만 열람한다.
- "본인만", "배정된 수강생", "상태만" 같은 조건부 값은 `requireCohortAccess` 뒤에 **리소스 단위 검사**(`ctx.user.id === ticket.requesterId` 등)로 처리한다.
- 계정 발급 대상 범위: ACADEMY_ADMIN은 **자기 학원** 안의 STUDENT·INSTRUCTOR·MANAGER 계정만 만들 수 있다. ACADEMY_ADMIN 계정과 학원 생성은 ADMIN만.

## 3. 반 간 접근 차단 테스트 (필수, 표 기반 약 10행)
시드 기준: 반 A(담임 `mgr_a`, 강사 `inst_a`, 수강생 `s01~s08`), 반 B(담임 `mgr_b`, 수강생 `b01·b02`).

| 행위자 | 대상 | 기대 |
| :-- | :-- | :-- |
| `mgr_a` | 반 B의 출결 조회·입력 | 거부 |
| `mgr_a` | 반 B 수강생의 티켓·증빙 | 거부 |
| `inst_a` | 반 B의 자료 조회 | 거부 |
| `s01` | 반 B의 어떤 데이터 | 거부 |
| `s01` | `s02`의 출결·티켓·증빙 | 거부 (같은 반이어도 본인만) |
| `s01` | 반 A 출결 입력 (`attendance:write`) | 거부 |
| `inst_a` | 반 A 출결 입력 | 거부 |
| `acad_admin` | 반 A, 반 B 전체 조회 | 허용 |
| `acad_admin` | 다른 학원의 반 | 거부 (다른 학원은 테스트 안에서 최소 데이터로 생성) |
| `mgr_a` | URL의 cohortId를 B로 바꾸고 body에 cohortId=A를 넣은 요청 | 거부 (URL 값이 기준) |
