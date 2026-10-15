# 개발 가이드

`AGENTS.md`·`CLAUDE.md`의 규칙을 실제로 적용하는 방법과 폴더 구조. 규칙과 충돌하면 규칙 파일이 우선한다.

## 1. 폴더 구조
```
src/app/                 라우트 (public: / /login /market, 로그인 후: /app/c/[cohortId]/..., /app/academy, /admin)
src/components/ui/       기본 UI 컴포넌트 (button, input, dialog, sheet 등 필요한 것만)
src/components/shell/    AppShell, 메뉴 정의(nav.ts), PageHeader, AccessDenied
src/components/widgets/  역할 간 공유하는 대시보드 위젯
src/components/          공용: StatusBadge, Widget, DataTable
src/lib/                 db.ts, auth/, access/(권한·반 범위), storage/, ai/, tickets/, config.ts, utils.ts(cn, formatDate)
src/lib/attendance/      출결 계산 순수 함수 (DB·Next 의존 금지)
src/server/              서버 액션·쿼리 (Prisma 호출은 여기서만)
prisma/                  schema.prisma, seed.ts, migrations/
docs/                    spec/, design/, decisions/, PROGRESS.md, dev-guide.md
```

## 2. DB·스키마
- 테이블 정의는 `prisma/schema.prisma`만 기준으로 삼는다. SQL DDL, ER 다이어그램, 모델 설명 문서는 따로 만들지 않는다.
- 스키마는 필요한 부분만 부분 편집한다. 모델은 해당 모듈 명세에 있는 것만 추가한다 (M5, M7~M10 모델은 해당 모듈 작업 때).
- 마이그레이션 생성: `npx prisma migrate dev --name <짧은이름>`
- 시드는 기존 `prisma/seed.ts`를 그대로 쓴다. faker나 반복문으로 대량 데이터를 만들지 않는다.

## 3. 테스트 작성법 (필수 3종)
1. 출결 계산: `docs/spec/attendance.md`의 표를 그대로 옮긴 표 기반 테스트 1개 파일
2. 권한: `docs/spec/permissions.md`의 표를 순회하는 표 기반 테스트 1개 파일 + 반 간 접근 차단 케이스
3. 티켓 전이: 허용 전이는 표에서, 불허 전이는 조합을 반복문으로 자동 생성 (손으로 하나씩 쓰지 않는다)
- 실행은 바꾼 파일 관련만: `npx vitest run <경로>`. 전체 실행은 모듈 완료 시 1회.

## 4. UI
- 상세·편집은 드로어(Sheet)·모달(Dialog)로 열어 페이지 이동을 줄인다.
- 메뉴·경로·라벨은 `docs/design/ia.md`를 그대로 따른다.
- 수강생 화면은 모바일(360px) 우선, 터치 영역 44px 이상.
- 클래스 병합은 `cn`(`src/lib/utils.ts`)을 쓴다. 커스텀 글자 크기를 추가하면 `cn`의 font-size 그룹에도 등록한다.
- 개발 서버(`npm run dev`, 포트 3333)가 떠 있는 동안 `next build`를 실행하지 않는다 (`.next`가 덮여 500 오류).

## 5. 읽기·출력 요령
- 파일은 필요한 범위만 읽는다 (`offset`/`limit`, grep). `node_modules`, `.next`, `package-lock.json`, `prisma/migrations/*` 내용은 읽지 않는다.
- 방금 쓴 파일은 다시 읽지 않는다. 편집이 성공하면 반영된 것으로 본다.
- 긴 명령 출력은 `| tail -n 30`으로 자른다. 같은 오류 로그를 반복해서 출력하지 않는다.
- 생성한 코드를 채팅에 다시 붙여 넣지 않는다. 최종 보고는 10줄 이내: 한 일, 실행한 검증, 사람이 할 일.
- README·주석·설명 문서를 자동으로 늘리지 않는다. 주석은 "왜"가 비자명할 때만 단다.
