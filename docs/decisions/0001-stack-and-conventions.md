# 0001. 스택과 기본 규약 (2026-10-15)

## 결정
- Next.js 15 App Router + TypeScript strict + Tailwind + shadcn/ui
- Prisma 6 (`mysql` 프로바이더로 MariaDB 연결). 7 이상은 설정 방식이 달라 올리지 않는다.
- 세션은 서버 저장형(`AuthSession`) + host-only 쿠키. 강제 로그아웃·비활성화 즉시 반영을 위해 JWT 대신 선택.
- `loginId`는 전체 유일. 로그인 화면에 학원 선택이 없다.
- 모델은 `Week`/`Lesson`(PRD의 Week/Session) — `Session`이 인증 세션과 혼동되어 `Lesson`으로 부른다.
- 날짜(출결·훈련일)는 `YYYY-MM-DD` 문자열(Asia/Seoul)로 다루고 DB는 `@db.Date`.
- 배열 필드(tags 등)는 MySQL에서 스칼라 리스트를 쓸 수 없어 `Json`으로 둔다.

## 이유
- 1인 개발(+AI 도구) 속도와 유지보수 단순성. 포트폴리오 설명 용이성.

## 확인할 것
- MariaDB에서 Prisma `Json` 컬럼이 정상 동작하는지 S0 마이그레이션 직후 확인 (읽기·쓰기 1회).
