# 개발 가이드

처음 이 프로젝트에 참여하는 팀원을 위한 안내서입니다. 개발 경력이 없어도 따라올 수 있게 썼습니다.
지켜야 할 규칙의 원본은 `CLAUDE.md`·`AGENTS.md`이고, 이 문서는 그 규칙을 **왜 지키는지, 실제로 어떻게 하는지** 풀어 설명합니다. 두 문서가 서로 다르면 규칙 파일을 따릅니다.

---

## 0. 이 프로젝트를 한 문장으로

KDT 학원의 **반(Cohort)마다** 출결, 병결·휴가 신청(티켓), 수업 자료·과제, 이력서, 팀 프로젝트를 관리하는 웹 서비스입니다.
가장 중요한 원칙은 두 가지입니다.

1. **반끼리 데이터가 섞이면 안 됩니다.** A반 강사가 B반 수강생 출결을 보면 사고입니다.
2. **출결 숫자는 틀리면 안 됩니다.** 훈련 장려금과 수료 여부가 걸려 있습니다.

아래 규칙 대부분이 이 두 원칙을 지키기 위해 있습니다.

---

## 1. 먼저 알아 둘 용어

| 용어 | 뜻 |
| :-- | :-- |
| 반 (Cohort) | 하나의 훈련 과정 반. 거의 모든 데이터가 어느 반 소속인지 `cohortId`로 표시됩니다. |
| 역할 (Role) | `STUDENT` 수강생, `INSTRUCTOR` 강사, `MANAGER` 매니저, `ACADEMY_ADMIN` 학원 관리자, `ADMIN` 슈퍼어드민 |
| 페이지 (page) | 주소 하나에 해당하는 화면. `src/app/.../page.tsx` 파일 하나가 화면 하나입니다. |
| 컴포넌트 | 화면을 이루는 부품(버튼, 표, 카드 등). 여러 화면에서 다시 씁니다. |
| 서버 액션 | 화면에서 "저장", "제출" 같은 버튼을 눌렀을 때 **서버에서** 실행되는 함수. 이름이 `…Action`으로 끝납니다. |
| 쿼리 함수 | DB에서 읽기만 하는 함수. `src/server/…-queries.ts`에 있습니다. |
| Prisma | DB를 코드로 다루는 도구. 표(테이블) 정의는 `prisma/schema.prisma`에 있습니다. |
| 마이그레이션 | DB 표 구조를 바꾸는 기록. 스키마를 고치면 마이그레이션을 새로 만듭니다. |
| 전이표 | "이 상태에서 누가 어떤 상태로 바꿀 수 있나"를 정리한 표. 예: 신청 → 승인/반려. |
| 순수 함수 | DB나 화면에 의존하지 않고 입력만 보고 결과를 내는 함수. 테스트하기 쉽습니다. |
| 저장소 (storage) | 업로드한 파일을 보관하는 곳. 지금은 서버 폴더(`STORAGE_DIR`)입니다. |

---

## 2. 폴더 지도: "무엇을 고치려면 어디를 여나"

```
src/app/                 화면(주소별 페이지)
  page.tsx               첫 화면 /
  login/                 로그인 /login
  market/                마켓플레이스 /market (로그인 없이 공개)
  app/                   로그인 후 화면 /app/...
    academy/             학원 관리 (학원 관리자)
    overview/            전체 반 요약 (강사·매니저)
    c/[cohortId]/        반 화면. [cohortId] 자리에 반 번호가 들어갑니다 (예: /app/c/3/attendance)
      attendance/        출결
      tickets/           병결·휴가 신청, 문의
      curriculum/        커리큘럼(주차·수업·자료·과제)
      resume/            이력서·자소서
      team/              팀 프로젝트·쇼케이스
  api/                   파일 내려받기 같은 서버 주소 (화면 아님)
src/components/          여러 화면이 함께 쓰는 부품
  ui/                    버튼·입력·모달 같은 기본 부품
  shell/                 화면 뼈대(메뉴, 상단 바), 메뉴 정의 nav.ts
  widgets/               홈 대시보드 카드
src/server/              서버 액션과 쿼리 함수 (DB 호출은 여기서만)
src/lib/                 공통 도구
  access/                권한 검사 (누가 무엇을 할 수 있나)
  attendance/            출결 계산 (순수 함수)
  storage/               파일 저장소
  dates.ts               날짜 도구
prisma/                  DB 정의(schema.prisma), 시드(가상 데이터), 마이그레이션
tests/                   권한 테스트
docs/                    명세(spec/), 디자인(design/), 진행 현황(PROGRESS.md)
```

**찾는 요령**
- 화면 글자나 버튼을 고치고 싶다 → 브라우저 주소를 보고 `src/app/`에서 같은 경로의 폴더를 엽니다.
- 저장할 때 동작을 고치고 싶다 → 화면 파일에서 `…Action`을 찾고, `src/server/`에서 그 함수를 엽니다.
- 메뉴를 고치고 싶다 → `src/components/shell/nav.ts`
- 모든 파일 첫 줄에는 **이 파일이 무엇인지** 설명하는 주석이 있습니다. 먼저 첫 줄을 읽어 보세요.

---

## 3. 요청이 흘러가는 길

수강생이 "과제 제출" 버튼을 누르면 이렇게 진행됩니다.

```
화면 (curriculum-view.tsx)
  └─ submitAssignmentAction(cohortId, 입력값)      ← src/server/curriculum.ts
       1. requireCohortAccess(cohortId, "submission:create")   ← 반 접근·권한 검사 (항상 첫 줄)
       2. zod로 입력값 검사 (링크 형식, 파일 형식·크기)
       3. Prisma로 DB 저장 (where에 항상 ctx.cohortId)
       4. 결과 { ok: true } 또는 { ok: false, error: "사용자에게 보일 문구" }
  └─ 화면이 결과를 받아 오류 문구를 보여 주거나 목록을 새로 고침
```

모든 기능이 이 모양을 따릅니다. 새 기능도 이 순서대로 만들면 됩니다.

---

## 4. 코드 컨벤션 (꼭 지키는 것)

### 4-1. 보안·데이터 규칙: 이유와 함께

| 규칙 | 왜 지키나 | 실제로 하는 법 |
| :-- | :-- | :-- |
| 반 데이터를 다루는 서버 액션은 **첫 줄에서** `requireCohortAccess`를 부른다 | 검사를 빠뜨리면 다른 반 데이터가 보입니다 | `const ctx = await requireCohortAccess(cohortId, "동작이름");` 이후에는 `ctx.cohortId`만 씁니다 |
| `cohortId`는 **주소(URL)에서** 받는다 | 화면이 보낸 값은 조작될 수 있습니다 | 입력 폼 안의 cohortId 값으로 권한을 판단하지 않습니다 |
| DB 조회의 `where`에 **항상 `cohortId`** | id만으로 찾으면 다른 반 데이터를 집을 수 있습니다 | `findFirst({ where: { id, cohortId: ctx.cohortId } })` |
| 권한 검사는 **서버에서** | 화면에서 버튼을 숨겨도 주소를 직접 치면 들어옵니다 | 화면 숨김은 편의일 뿐, 서버 액션에서 다시 검사합니다 |
| DB 호출(Prisma)은 **`src/server/`에서만** | 권한 검사 없는 DB 호출이 여기저기 생기는 것을 막습니다 | 화면 파일에서 `db.`를 직접 쓰지 않습니다 |
| 출결 누계는 **저장하지 않고 매번 계산** | 저장해 두면 원본 기록과 어긋날 수 있습니다 | 계산은 `src/lib/attendance/`의 함수로만 합니다 |
| 출결 규칙 값(허용 비율 등)은 **반 설정에서 읽는다** | 반마다, 학원마다 값이 다릅니다 | `Cohort.attendanceConfig`에서 읽고, 코드에 숫자를 박지 않습니다 |
| 파일은 **저장소 도구(`src/lib/storage`)로만** | 저장 위치가 바뀌어도 코드를 고치지 않기 위해서, 그리고 권한 없이 파일이 열리지 않게 하기 위해서 | `saveFile`로 저장하고, 내려받기는 권한 확인 후 `fileResponse`로 보냅니다. 파일 주소를 직접 만들지 않습니다 |
| 실제 수강생 정보는 **쓰지 않는다** | 개인정보입니다 | 시드와 예시는 모두 가상 이름·가상 데이터입니다 |
| 비밀값(`.env`)은 **출력·커밋하지 않는다** | 유출되면 서버가 위험합니다 | `.env.example`에는 키 이름만 둡니다 |

### 4-2. 날짜

- 출결·훈련일 날짜는 **`"2026-07-20"` 같은 글자(문자열)**로 다룹니다. 기준은 한국 시간(Asia/Seoul)입니다.
- `new Date("2026-07-20")`처럼 바로 날짜 객체로 바꿔 비교하지 않습니다. 시간대 때문에 하루가 밀릴 수 있습니다.
- 날짜 계산은 `src/lib/dates.ts`의 함수(`isYmd`, `addDaysYmd`, `ymdToDate`, `dateToYmd` 등)를 씁니다.

### 4-3. 이름 짓기

| 대상 | 규칙 | 예 |
| :-- | :-- | :-- |
| 서버 액션 | 동사 + 대상 + `Action` | `createMaterialAction`, `deleteEventAction` |
| 쿼리 함수 | `get…`, `list…`, `count…` | `getCurriculum`, `listTickets`, `countNewLeads` |
| 권한 판정 순수 함수 | `can…Pure` | `canViewSubmissionFilePure` |
| 권한 동작 이름 | `대상:동작` | `material:write`, `ticket:readOwn` |
| 컴포넌트·컴포넌트 파일(공용) | 대문자로 시작(PascalCase) | `StatusBadge.tsx`, `TicketDrawer.tsx` |
| 페이지 안에서만 쓰는 화면 파일 | 소문자-하이픈(kebab-case) | `curriculum-view.tsx`, `day-sheet.tsx` |
| 서버 파일 | 쓰기는 `대상.ts`, 읽기는 `대상-queries.ts` | `tickets.ts`, `ticket-queries.ts` |
| 변수·함수 | 소문자로 시작(camelCase) | `dueAt`, `formatSize` |
| 화면에 보이는 글자 | 한국어 존댓말, 짧게 | "제출할 링크나 파일을 넣어 주세요." |

### 4-4. 서버 액션 모양

모든 서버 액션은 결과를 아래 둘 중 하나로 돌려줍니다. 화면은 `ok`를 보고 성공·실패를 나눕니다.

```ts
{ ok: true }                                   // 성공
{ ok: false, error: "사용자에게 보여 줄 문구" }   // 실패 (권한 없음, 입력 오류 등)
```

- 입력값 검사는 **zod**로 합니다 (`z.string().max(200)` 같은 식). 검사 실패 문구는 사용자가 읽을 문장으로 씁니다.
- 권한 없음(`AccessDeniedError`)은 `wrap` 함수가 잡아서 "권한이 없습니다."로 바꿉니다.

### 4-5. 상태 바꾸기 (티켓·서류·쇼케이스)

- "어떤 상태에서 어떤 상태로 바뀔 수 있나"는 **전이표 한 곳**에만 적습니다.
  - 티켓 `src/lib/tickets/transitions.ts` (명세 `docs/spec/ticket-state.md`)
  - 서류 `src/lib/documents/transitions.ts`, 쇼케이스 `src/lib/showcase/transitions.ts`
- 화면 버튼과 서버 검사가 **같은 표**를 봅니다. `if (status === "PENDING")` 같은 조건을 여기저기 새로 쓰지 않습니다.

### 4-6. 화면(UI)

- 색·글자 크기·간격은 **`docs/design/theme.md`의 토큰만** 씁니다. 메인 색은 `#3F58D4`(코드에서는 `primary-500` 등)입니다.
  - 안 되는 예: `bg-[#123456]`, `text-[13px]`, 새 폰트·아이콘 패키지 설치
- 상태 표시는 항상 **`StatusBadge`**(색 + 아이콘 + 글자)를 씁니다. 색약 사용자도 구분할 수 있어야 하기 때문입니다.
- 대시보드 카드는 항상 **`Widget`**으로 감쌉니다. 로딩·빈 상태·오류를 카드마다 따로 보여 줍니다.
- 상세 보기·편집은 페이지를 옮기지 않고 **드로어(Sheet)나 모달(Dialog)**로 엽니다.
- 수강생 화면은 **휴대폰(가로 360px) 먼저** 만듭니다. 누르는 영역은 44px 이상입니다.
- 메뉴 이름·주소는 `docs/design/ia.md`를 그대로 따릅니다.
- CSS 클래스를 조건에 따라 합칠 때는 `cn(...)`(`src/lib/utils.ts`)을 씁니다.

### 4-7. 주석

**모든 파일 첫 줄**에는 이 파일이 무엇인지 적습니다. 어떤 화면인지, 어떤 기능 묶음인지 한 줄이면 됩니다.

```ts
// 출결 > 오늘 출결표(매니저): 수강생별 출석·지각·조퇴·결석 체크와 하루 마감.
```

- `"use client"`나 `"use server"`가 있는 파일은 그 줄 바로 다음에 적습니다.
- **밖에서 쓰는 함수(export)**에는 무엇을 하는지 한 줄 설명을 붙입니다. 파일 하나가 화면 하나뿐이면 파일 첫 줄 설명으로 충분합니다.
  ```ts
  /** 과제 삭제. 제출물이 있으면 막는다. */
  export async function deleteAssignmentAction(...)
  ```
- 줄마다 주석을 달지 않습니다. 코드만 봐서는 **왜 그렇게 했는지** 알기 어려운 곳에만 짧게 적습니다.
  - 좋은 예: `// 비공개 전환이 곧 반영되도록 짧게만 캐시`
  - 필요 없는 예: `// i를 1 증가`
- 주석은 한국어로, 코드를 바꾸면 주석도 함께 고칩니다.

---

## 5. 새 기능을 만드는 순서 (따라 하기)

예: "수업에 공지 글을 달 수 있게 한다"

1. **명세 확인**: `docs/spec/modules.md`에서 해당 모듈 절을 읽습니다. 명세에 없는 기능이면 먼저 물어봅니다.
2. **DB**: `prisma/schema.prisma`에 모델·컬럼을 추가합니다. 반 데이터라면 `cohortId`를 꼭 넣습니다.
   그다음 `npx prisma migrate dev --name 짧은이름`으로 마이그레이션을 만듭니다.
3. **권한**: 새 동작이 필요하면 `src/lib/access/permissions.ts` 권한표에 한 줄 추가합니다(역할별 true/false).
4. **서버**: `src/server/`에 서버 액션(쓰기)과 쿼리 함수(읽기)를 만듭니다. 첫 줄 `requireCohortAccess`, `where`에 `cohortId`.
5. **화면**: `src/app/app/c/[cohortId]/...`에 페이지와 화면 파일을 만들고 서버 액션을 연결합니다.
6. **확인**: 아래 명령 세 개가 모두 통과해야 끝입니다.
   ```bash
   npm run lint
   npx tsc --noEmit
   npx vitest run
   ```
7. **기록**: `docs/PROGRESS.md`에 한 일과 결정 사항을 한 줄씩 적습니다.

---

## 6. DB·스키마

- 표 정의는 `prisma/schema.prisma`만 기준으로 삼습니다. 따로 ER 그림이나 SQL 문서를 만들지 않습니다.
- 스키마는 필요한 부분만 고칩니다. 모델은 해당 모듈 명세에 있는 것만 추가합니다.
- 마이그레이션 만들기: `npx prisma migrate dev --name <짧은이름>`
- **하면 안 되는 명령**: `npx prisma migrate reset`, `db push --force-reset`, 테이블 DROP. DB 데이터가 모두 지워집니다. 꼭 필요하면 팀장에게 먼저 말합니다.
- 시드(가상 데이터)는 `prisma/seed.ts`를 그대로 씁니다. 대량의 가짜 데이터를 만들지 않습니다.

---

## 7. 테스트 (필수 3종만)

모든 코드를 테스트하지 않고, **틀리면 사고가 나는 세 가지**만 테스트합니다.

1. **출결 계산**: `docs/spec/attendance.md`의 표를 그대로 옮긴 표 기반 테스트 (`src/lib/attendance/compute.test.ts`)
2. **권한**: 권한표 전체 + 반 간 접근 차단 케이스 (`tests/permissions-matrix.test.ts`, `tests/cohort-isolation.test.ts`)
3. **티켓 전이**: 허용 전이는 표에서, 불허 전이는 모든 조합을 자동 생성 (`src/lib/tickets/transitions.test.ts`)

- 화면·스냅샷·단순 저장/조회 테스트는 쓰지 않습니다. 필요해 보이면 먼저 물어봅니다.
- 실행: 바꾼 부분만 `npx vitest run <경로>`, 모듈을 마칠 때 전체 `npx vitest run`

---

## 8. 자주 하는 실수

| 실수 | 결과 | 바로잡기 |
| :-- | :-- | :-- |
| `findUnique({ where: { id } })`로 반 데이터 조회 | 다른 반 데이터가 열림 | `findFirst({ where: { id, cohortId: ctx.cohortId } })` |
| 화면에서 버튼만 숨기고 서버 검사 생략 | 주소를 직접 쳐서 실행 가능 | 서버 액션 첫 줄 `requireCohortAccess` |
| `new Date("2026-07-20")`로 날짜 비교 | 하루 밀림 | 문자열 비교 또는 `src/lib/dates.ts` |
| 출결 허용 비율 `0.2`를 코드에 직접 씀 | 반마다 다른 규칙이 무시됨 | `attendanceConfig`에서 읽기 |
| `bg-[#3F58D4]`처럼 색을 직접 씀 | 디자인이 어긋남 | `bg-primary-500` 같은 토큰 |
| 파일을 `public/` 폴더에 저장 | 로그인 없이 누구나 열람 | `saveFile` + 권한 확인 라우트 |
| 개발 서버가 켜진 채로 `next build` | `.next`가 덮여 500 오류 | 개발 서버를 끄고 빌드 |

---

## 9. 에이전트(AI) 작업 요령

AI 코딩 도구에게 맡길 때 적용하는 요령입니다. 사람도 참고하면 좋습니다.

- 파일은 필요한 범위만 읽습니다(검색으로 위치를 찾고 그 부분만). `node_modules`, `.next`, `package-lock.json`, `prisma/migrations/*` 내용은 읽지 않습니다.
- 방금 쓴 파일은 다시 읽지 않습니다. 편집이 성공하면 반영된 것으로 봅니다.
- 긴 명령 출력은 `| tail -n 30`으로 자릅니다. 같은 오류 로그를 반복해서 출력하지 않습니다.
- 생성한 코드를 채팅에 다시 붙여 넣지 않습니다. 최종 보고는 10줄 이내: 한 일, 실행한 검증, 사람이 할 일.
- 새 파일을 만들면 첫 줄 설명 주석과 export 함수 한 줄 설명(4-7절)을 함께 씁니다. 그 밖의 설명 문서는 요청이 있을 때만 늘립니다.
