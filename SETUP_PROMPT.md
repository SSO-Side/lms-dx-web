# 기본 세팅 프롬프트 (S0)

## 사용 순서 (사람이 하는 일)
1. 저장소 폴더를 만들고 이 문서 세트를 **그대로** 복사한다: `AGENTS.md`, `CLAUDE.md`, `.env.example`, `docs/`, `prisma/schema.prisma`, `prisma/seed.ts`.
2. `.env`를 저장소 루트에 만든다. 최소한 `DATABASE_URL`이 들어 있어야 한다 (`.env.example` 참고).
3. 섀도 DB를 만든다 (`prisma migrate dev`가 임시로 쓰는 빈 DB). DB 관리자 계정으로 실행:
   ```sql
   CREATE DATABASE lms_kdt_shadow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   GRANT ALL PRIVILEGES ON lms_kdt_shadow.* TO '앱계정'@'%';
   FLUSH PRIVILEGES;
   ```
   그리고 `.env`에 `SHADOW_DATABASE_URL`(DB 이름만 `lms_kdt_shadow`로 바꾼 같은 접속 정보)을 추가한다. 본 DB(`lms_kdt`)도 한글 저장을 위해 `utf8mb4`인지 확인한다.
4. 시드를 쓸 거라면 `.env`에 `ALLOW_SEED="true"`와 `SEED_PASSWORD`(8자 이상, 가상 계정 공통 비밀번호)를 넣는다. **이 DB는 개발용 가상 데이터 DB**로 쓴다.
5. Claude Code(또는 Antigravity)를 저장소 루트에서 **새 세션**으로 열고 아래 프롬프트를 붙여 넣는다.
6. Antigravity가 `AGENTS.md`를 규칙으로 인식하지 않으면, 프롬프트 첫 줄의 "AGENTS.md를 읽는다"가 대신 처리하므로 그대로 진행하면 된다 (필요하면 Rules에 같은 내용을 붙여 넣는다).

## 프롬프트 (이 블록을 그대로 붙여 넣기)

````
저장소 루트에서 lms_kdt 프로젝트의 기본 세팅(S0)만 수행해 줘. 기능 구현은 하지 마.

[먼저 읽을 것 — 이 4개만]
- AGENTS.md (규칙 전체)
- docs/PROGRESS.md
- docs/spec/modules.md 의 "S0" 절과 docs/decisions/0001-stack-and-conventions.md
- prisma/schema.prisma 는 전체를 읽지 말고 `npx prisma validate` 결과만 본다
다른 docs 파일은 읽지 마.

[진행 방식]
- 계획을 길게 보고하지 말고 아래 단계를 순서대로 진행해. 단, 단계 안에서 "[사용자 작업]"이 필요하면 해당 명령·절차를 한 번만 안내하고 그 단계에서 멈춰. 우회하거나 재시도를 반복하지 마.
- .env 의 값은 절대 출력·로그·커밋하지 마. 확인이 필요하면 키 이름만 본다 (예: sed 's/=.*//' .env).

[1단계: 점검]
1. Node 버전이 20 이상인지 확인.
2. .env 가 있고 DATABASE_URL, SHADOW_DATABASE_URL 키가 있는지 확인. SHADOW_DATABASE_URL 이 없으면 [사용자 작업]으로 섀도 DB 생성 절차(SETUP_PROMPT.md 사용 순서 3번)를 안내하고 멈춰.
3. .env.example 에는 있는데 .env 에 없는 키는 이름만 추가(값은 비움). SESSION_SECRET 이 비어 있으면 `openssl rand -base64 32` 결과를 .env 에 직접 기록(화면에 출력하지 않는다). ALLOW_SEED 는 건드리지 않는다.
4. .gitignore 에 .env, .env.*(단 .env.example 제외), .storage 가 포함되도록 한다.

[2단계: Next.js 스캐폴드]
- Next.js 15, TypeScript, Tailwind, ESLint, App Router, src/ 디렉터리, import alias @/*, npm 으로 생성. 기존 파일(AGENTS.md, CLAUDE.md, docs/, prisma/, .env*)을 덮어쓰지 않는다. create-next-app 이 비어 있지 않은 폴더 때문에 실패하면 임시 하위 폴더에 생성한 뒤 필요한 파일만 옮기고 임시 폴더는 지운다.
- package.json 이름은 lms_kdt. next 는 15.x 로 고정한다.

[3단계: 의존성 — 아래 목록만, 이 외는 추가하지 마]
- 런타임: @prisma/client@6, zod, bcryptjs
- 개발: prisma@6, vitest, tsx, @types/bcryptjs(필요한 경우만)
- shadcn/ui 초기화 후 컴포넌트는 button, input, label, card, sheet, dialog, table, badge 만 추가.
- package.json 설정: scripts 에 test(vitest), typecheck(tsc --noEmit), db:migrate(prisma migrate dev), db:seed(prisma db seed) 추가, "prisma": { "seed": "tsx prisma/seed.ts" } 추가. vitest.config.ts 에 @ 별칭 설정.

[4단계: 뼈대 파일 — 최소한만]
- 폴더(.gitkeep): src/lib/auth, src/lib/access, src/lib/attendance, src/lib/tickets, src/lib/storage, src/lib/ai, src/server, src/components/widgets
- src/lib/db.ts: Prisma 클라이언트 싱글턴(개발 모드 핫리로드 대응)
- src/lib/config.ts: zod 로 환경변수 검증(누락 시 키 이름만 에러에 포함, 값은 출력하지 않는다)
- src/app/api/health/route.ts: `SELECT 1` 로 DB 연결 확인 후 { ok: true } 반환(오류 시 접속 정보 없이 { ok: false })
- src/app/page.tsx: "lms_kdt" 제목 한 줄과 로그인·마켓플레이스 자리표시 링크 2개만. 스타일링에 시간 쓰지 마.
- README 는 건드리지 않는다.

[5단계: DB]
1. `npx prisma validate` → `npx prisma generate`. 스키마 문법 오류가 나면 해당 부분만 최소 수정하고 무엇을 고쳤는지 보고에 포함.
2. `npx prisma migrate dev --name init`. 접속 실패(P1001, P1000 등)나 섀도 DB 권한 오류(P3014 등)가 나면 오류 코드와 한 줄 원인만 보고하고 [사용자 작업]으로 멈춰. SSH 터널, 포트 변경 같은 우회는 시도하지 마. migrate reset 은 절대 실행하지 마.
3. 마이그레이션이 성공하면 .env 에 ALLOW_SEED="true" 와 SEED_PASSWORD 가 모두 설정되어 있는지 키/값 존재 여부만 확인(값 출력 금지). 있으면 `npx prisma db seed` 실행. 없으면 [사용자 작업]으로 안내하고 이 항목만 건너뛴다.
4. 시드 후 확인: tsx 한 줄 스크립트로 User 수, Cohort 수, 첫 Cohort 의 weeklySchedule 이 객체로 읽히는지(MariaDB Json 동작) 출력. 출력은 3줄 이내. 확인용 스크립트 파일은 남기지 않는다.

[6단계: 검증]
- `npm run lint`, `npm run typecheck`, `npm run build` 를 각각 1회 실행(출력은 tail -n 20 으로 자른다). 실패하면 원인을 고치고 해당 명령만 다시 실행.
- 테스트는 아직 없으므로 `npm test` 는 실행하지 않는다.

[7단계: 마무리]
- docs/PROGRESS.md 에서 S0 를 완료로 표시하고 "다음 할 일"을 M0 로 바꾼다. 결정 사항에 변경한 것이 있으면 한 줄 추가.
- git 커밋은 하지 마.
- 최종 보고는 10줄 이내: ① 완료한 단계 ② 고친 것(있다면) ③ 검증 결과(lint/타입/빌드/DB) ④ [사용자 작업] 목록(health 확인을 위해 `npm run dev` 후 브라우저에서 /api/health 열기, Prisma Studio 로 시드 확인 `npx prisma studio`, git 저장소 연결 등).

[하지 말 것]
인증·권한·출결 등 기능 코드 작성, 위 목록 외 패키지 설치, 설정 파일 대규모 재작성, docs/ 자동 생성·확장, 서버(Nginx/pm2/Docker) 설정, 운영 DB 변경.
````

## 세팅 후 다음 단계
- 새 세션에서 `docs/spec/modules.md`의 **M0**부터 한 모듈씩 시작한다. 프롬프트 예: "AGENTS.md 규칙대로 M0를 진행해 줘. 계획을 10줄 이내로 먼저 보여 줘."
- 모듈이 끝나면 `/clear`(Claude Code) 또는 새 대화로 다음 모듈을 시작한다.
