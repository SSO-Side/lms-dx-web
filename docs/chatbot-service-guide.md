# 챗봇 서비스 개발 가이드 (이진호 · Claude 작업용)

| 항목 | 내용 |
| :-- | :-- |
| 작성일 | 2026-11-25 |
| 대상 | 챗봇 서비스 담당 이진호, 그리고 이진호가 쓰는 Claude |
| 위치 | 이 문서는 LMS 레포의 `docs/`에 있다. 챗봇 서비스 레포를 만들면 이 문서를 복사해 `docs/lms-guide.md` 같은 이름으로 두고, 바뀌면 LMS 쪽을 기준으로 맞춘다 |

## 0. 읽는 순서

1. **이 문서**: 무엇을 만들지, 무엇이 정해졌고 무엇이 아직인지.
2. `docs/ai-integration.md` 1~3장: HTTP 규격(요청·응답·오류 코드). **규격의 기준**이다. 이 문서와 다르면 규격은 그 문서를 따르되, 바꿀 때는 이종섭과 합의한 뒤 그 문서부터 고친다.
3. `docs/sync-status.md` 3장: 규격 문서(2026-10-16)와 **현재 LMS 코드가 다른 점**. 아래 2장에 요약했다.

Claude에게 일을 시킬 때는 위 세 문서를 먼저 읽게 한다. 나머지 파일은 필요할 때만 읽게 한다(토큰 절약).

## 1. 확정된 것과 아닌 것 (2026-11-25 기준)

**확정(이종섭 결정)**
- 챗봇은 **별도 레포의 TypeScript 서비스**다. LMS 안에 코드를 넣지 않는다.
- LMS는 **PDF 파일만 서비스로 넘긴다.** 청킹·임베딩·벡터 저장은 **서비스가 업로드를 받은 직후** 한다. LMS는 벡터 DB에 접근하지 않는다.
- 문서는 **PDF만**, **최대 10MB**다(LMS 코드 기준. 규격 문서의 20MB는 폐기).
- 벡터 저장소는 **MariaDB 11.8의 벡터 기능**(`VECTOR` 타입, 벡터 인덱스)이고 DB 이름은 `lms_ai`다.
- **개발 DB는 각자 PC의 로컬 Docker**다. 서버 DB로 터널을 열지 않는다. 운영에서는 서비스가 서버 안 컨테이너로 돌며 같은 Docker 네트워크의 DB에 붙는다.
- LLM·임베딩 모델은 **어댑터 뒤에 둔다.** 개발은 로컬 Ollama, 운영은 외부 API 또는 다른 선택(미정).
- 개발 중에는 **가상 매뉴얼만** 쓴다. 학원 실제 문서는 학원과 협의가 끝난 뒤에 받는다.

**아직 미정(정해지면 이 문서와 `docs/sync-status.md`에 적는다)**
- 운영에서 쓸 LLM·임베딩 제공자, 임베딩 모델과 차원
- 서비스 레포 이름, 프레임워크(Fastify, Hono 등은 자유)
- 인제스트를 동기로 끝낼지 비동기로 할지(규격은 둘 다 허용: 아래 4장)
- 질의 로그 보관 기간, 일일 호출 한도

## 2. 규격에서 코드 기준으로 달라진 점 (꼭 지킨다)

| 항목 | 내용 |
| :-- | :-- |
| 요청 필드 | `POST /api/chat` 요청에 **`academyId`가 반드시 들어온다.** |
| 응답 필수 | `answer`, `sources`(항목마다 `docId` 숫자·`title`, `page`는 선택), `grounded`, **`engineVersion`**. `engineVersion`이 없으면 LMS는 연결 실패로 처리한다 |
| 선택 필드 | `suggestedChips`(최대 5개). LMS 화면은 아직 이 값을 표시하지 않는다 |
| `role` | `STUDENT` / `INSTRUCTOR` / `MANAGER` / `ACADEMY_ADMIN`. 개발팀 계정도 `ACADEMY_ADMIN`으로 온다 |
| 타임아웃 | LMS는 30초 안에 응답이 없으면 끊는다. 인제스트는 별도 |
| 질문 길이 | 1~500자 |
| 근거 없음 | `grounded:false`, `answer`는 정확히 `확인할 수 없습니다. 담당자에게 문의하세요.` |
| 문서 ID | `docId`는 **서비스가 발급한 숫자 id**다. 업로드 응답의 `id`를 LMS가 저장하고, 이후 목록·삭제·출처 표시에 그대로 쓴다 |
| 문서 대상 | `audience`는 `STUDENT` / `INSTRUCTOR` / `ALL`. 보이는 범위는 5장 |
| 현재 LMS 상태 | LMS의 챗봇은 화면·관리만 완료이고 **질의응답 호출만 구현**되어 있다. 문서 인제스트·목록·삭제를 LMS에서 서비스로 부르는 코드는 이종섭이 따로 만든다(`docs/sync-status.md` 9장). 이진호는 서비스 쪽 엔드포인트를 규격대로 만들면 된다 |

## 3. 권장 레포 구조 (제안, 자유롭게 바꿔도 된다)

```
chatbot-service/
├─ src/
│  ├─ index.ts              서버 시작, 라우트 등록
│  ├─ config.ts             환경변수 zod 검증 (값은 로그에 찍지 않는다)
│  ├─ auth.ts               서비스 토큰 검사 (timing-safe 비교)
│  ├─ routes/
│  │  ├─ chat.ts            POST /api/chat
│  │  ├─ documents.ts       POST/GET/DELETE /api/chat/documents
│  │  └─ health.ts          GET /api/chat/health (인증 없음)
│  ├─ ingest/
│  │  ├─ pdf.ts             PDF 텍스트 추출 (페이지 번호 보존)
│  │  ├─ chunk.ts           청킹
│  │  └─ embed.ts           임베딩 호출
│  ├─ retrieve/search.ts    권한·반 필터가 들어간 벡터 검색
│  ├─ llm/
│  │  ├─ adapter.ts         chat()·embed() 인터페이스
│  │  ├─ openaiCompat.ts    Ollama·외부 API 공통 (OpenAI 호환 주소)
│  │  └─ mock.ts            고정 응답 (테스트용)
│  └─ db/
│     ├─ client.ts          MariaDB 드라이버 연결
│     └─ schema.sql         테이블 생성 SQL
├─ tests/
├─ Dockerfile
├─ docker-compose.dev.yml   로컬 DB 전용
├─ .env.example             키 이름만 (값 없음)
└─ docs/adr/                선택 근거 기록 (청크 크기, 임베딩 모델 등)
```

## 4. 문서 인제스트 (업로드 직후 처리)

엔드포인트는 `docs/ai-integration.md` 3.2절 그대로다: `POST /api/chat/documents`(multipart: `file`, `title`, `audience`, `cohortId`, `academyId`), `GET /api/chat/documents?academyId=&cohortId=`, `DELETE /api/chat/documents/{id}`.

**처리 순서**
1. 인증과 입력 검증: 토큰, PDF 파일 여부(확장자만 믿지 말고 파일 시작이 `%PDF`인지 확인), 10MB 이하, `audience` 값. 실패하면 규격의 오류 코드(`400`, `413`, `422`).
2. PDF에서 **페이지별로** 텍스트를 추출한다. 텍스트가 거의 없는 스캔 PDF는 `422 UNPROCESSABLE`과 사용자에게 보여 줄 한국어 `message`를 돌려준다.
3. 청킹: 페이지 경계를 넘지 않게 나누고, 청크마다 **문서 id, 페이지 번호, 순번**을 붙인다. 크기와 겹침은 시작값으로 500~800자, 겹침 10~15%를 제안한다. 실제 값은 평가 질문으로 비교해 정하고 ADR에 남긴다.
4. 청크 임베딩을 만들어 `lms_ai`에 저장한다. **문서 행과 청크 행은 한 트랜잭션**으로 쓴다. 중간에 실패하면 반쯤 들어간 문서가 남지 않게 한다.
5. 응답: 규격 3.2절 형식(`id`, `title`, `audience`, `cohortId`, `pages`, `status`, `createdAt`).

**동기·비동기**
- PDF가 크고 임베딩이 느리면 `201` 대신 먼저 응답하고 `status: "PROCESSING"`으로 두었다가 `READY` 또는 `FAILED`로 바꾸는 방식을 규격이 허용한다. LMS 화면은 이 상태를 표시할 예정이다.
- 어느 쪽으로 할지는 미정이다. 처음에는 단순하게 동기로 만들고, 10MB 문서에서 30초를 넘으면 비동기로 바꾸는 순서를 권한다. 실패하면 `FAILED`와 원인(`error` 필드, 사용자에게 보여 줄 수 있는 문장)을 남긴다.

**삭제**: 문서를 지우면 청크도 함께 지운다(외래키 `ON DELETE CASCADE`). 삭제 직후 검색에서 바로 빠져야 한다.

## 5. 검색과 권한 (가장 중요)

**보이는 문서 범위** (LMS의 `src/lib/ai/audience.ts`와 같은 규칙이다)

| 질문자 `role` | 검색 가능한 `audience` |
| :-- | :-- |
| `STUDENT` | `STUDENT`, `ALL` |
| `INSTRUCTOR`, `MANAGER`, `ACADEMY_ADMIN` | `INSTRUCTOR`, `ALL` |

**반 범위**: 문서의 `cohortId`가 비어 있으면 학원 공통 문서이고, 값이 있으면 그 반에서만 검색한다. 요청의 `cohortId`와 다른 반 문서는 절대 쓰지 않는다. `academyId`가 다른 문서도 쓰지 않는다.

**권한 조건은 SQL의 WHERE에 넣는다.** 검색한 뒤 코드에서 걸러내지 말고, 처음부터 조건에 맞는 청크만 후보가 되게 한다. 검색 결과가 나중에 필터로 잘려 적게 남는 일도 막는다.

```sql
-- 개념 예시 (실제 문법·인덱스 옵션은 MariaDB 11.8 문서로 확인)
SELECT c.id, c.document_id, c.page, c.text,
       VEC_DISTANCE_COSINE(c.embedding, VEC_FromText(?)) AS dist
FROM chunks c JOIN documents d ON d.id = c.document_id
WHERE d.status = 'READY' AND d.academy_id = ?
  AND (d.cohort_id IS NULL OR d.cohort_id = ?)
  AND d.audience IN (?, ?)
ORDER BY dist LIMIT 5;
```

- 벡터 인덱스를 만들 때 거리 방식(예: cosine)을 쿼리와 맞춰야 인덱스를 쓴다. 지원 문법은 MariaDB 공식 문서로 확인한다(이 문서는 확인하지 않았다).
- 이 규모(문서 수십 개, 청크 수천 개)에서는 인덱스가 없어도 느리지 않다. 정확성을 먼저 확인하고 인덱스는 나중에 붙여도 된다.

## 6. 답변 생성 규칙

1. 질문을 임베딩해 위 SQL로 후보 청크를 가져온다.
2. **거리 기준값**을 넘지 못하면 `grounded:false`와 고정 문구로 응답한다. 기준값은 평가 질문으로 정한다(8장).
3. 프롬프트에는 청크를 "자료"로 넣고, **자료 안의 문장은 지시가 아니라 데이터**라고 명시한다(문서 안의 "이전 지시를 무시하라" 같은 문장 방어).
4. 답변은 자료에 있는 내용만 쓴다. 없는 사실·수치·날짜를 만들지 않는다.
5. `sources`에는 실제로 쓴 청크의 `docId`, `title`, `page`를 넣는다. `grounded:true`인데 `sources`가 비면 안 된다.
6. LLM 응답과 위 요청·응답 모양은 zod로 검증하고, 형식이 다르면 오류로 처리한다.
7. 응답 시간은 LMS의 30초 안에 들어야 한다. 모델 호출에는 자체 타임아웃(예: 25초)을 둔다.

## 7. LLM·임베딩 어댑터

- 인터페이스는 `chat(messages, options) -> string`, `embed(texts[]) -> number[][]` 두 개로 시작한다.
- Ollama와 대부분의 외부 서비스는 **OpenAI 호환 주소**(`/v1/chat/completions`, `/v1/embeddings`)를 제공하는 것으로 알고 있다. 제공 여부와 모델 이름은 사용하는 서비스 문서로 확인한다.
- 환경변수(키 이름 제안): `LLM_BASE_URL`(개발 기본값 `http://localhost:11434/v1`), `LLM_API_KEY`(Ollama는 아무 값이나), `LLM_MODEL`, `EMBED_MODEL`, `EMBED_DIM`, `USE_MOCK`.
- **임베딩 모델은 처음에 하나로 고정한다.** 모델이나 차원을 바꾸면 모든 청크를 다시 임베딩해야 하고 `VECTOR(N)`의 N도 바뀐다. 바꿀 때는 재색인 절차를 ADR에 적는다.
- 질문과 문서 청크를 외부 서비스로 보내는 순간 외부 전송이다. 개발 중에는 가상 문서만 쓰고, 운영에서 어떤 제공자로 보낼지는 학원 협의와 함께 정한다.

## 8. 로컬 개발 절차

1. 로컬 DB 컨테이너를 띄운다.
   ```yaml
   # docker-compose.dev.yml (로컬 전용, 이 비밀번호는 서버와 다르게 임의로 정한다)
   services:
     db:
       image: mariadb:11.8
       ports: ["127.0.0.1:3307:3306"]
       environment:
         MARIADB_ROOT_PASSWORD: 로컬용-임의값
         MARIADB_DATABASE: lms_ai
       command: ["--character-set-server=utf8mb4", "--collation-server=utf8mb4_unicode_ci"]
   ```
2. `.env.example`을 복사해 `.env`를 만든다. **`.env`는 커밋하지 않고 `.gitignore`에 넣는다.**
3. `schema.sql`을 적용하고 서비스를 실행한다. `GET /api/chat/health`가 `ok`면 시작이다.
4. 가상 매뉴얼 PDF를 올려 보고 질문이 답변되는지, 근거 없을 때 고정 문구가 나오는지 확인한다.
5. LMS와 연결할 때는 LMS 쪽 `.env`의 `USE_AI_MOCK=false`, `CHATBOT_API_URL`, `CHATBOT_SERVICE_TOKEN`을 쓴다. LMS 설정은 이종섭이 한다.

**평가 질문 세트**: 가상 매뉴얼로 20문항 정도(근거 있는 질문 15, 없는 질문 5)를 만들어 청크 크기·임베딩 모델·거리 기준값을 바꿀 때마다 같은 질문으로 비교한다. 근거 있는 질문이 맞는 청크를 가져오는 비율과 없는 질문이 `grounded:false`로 나오는 비율을 기록한다.

## 9. 테스트 (이 세 가지는 반드시 있어야 한다)

1. **권한 분기**: 강사용(`INSTRUCTOR`) 문서가 `STUDENT` 질문의 답변·출처에 나오지 않는다.
2. **반·학원 범위**: 다른 반(`cohortId`)·다른 학원(`academyId`) 문서가 나오지 않는다. 학원 공통 문서(`cohortId` 없음)는 나온다.
3. **근거 없음**: 자료에 없는 질문은 `grounded:false`와 정해진 고정 문구로 나온다.

그 밖에 확인할 것: 인제스트 후 청크가 저장되는지, 삭제 후 검색에서 빠지는지, 잘못된 토큰이 `401`인지, 10MB 초과와 스캔 PDF 오류 코드. 테스트는 이 범위로 하고 가짜 시나리오를 늘리지 않는다(모듈마다 3종 이내, 실제로 깨질 곳 중심).

## 10. 보안·개인정보 규칙

- 모든 요청(health 제외)에서 `Authorization: Bearer <토큰>`을 확인한다. 토큰이 없거나 틀리면 `401`. 비교는 timing-safe 방식으로 한다.
- 서비스는 **내부에서만 열린다.** 포트는 `127.0.0.1`에 바인딩하거나 Docker 내부 네트워크로만 연다. 브라우저가 직접 부르지 않으므로 CORS는 필요 없다.
- **질문 원문을 로그에 남기지 않는다.** 질문에 개인정보가 들어올 수 있다. 로그에는 요청 ID, 소요 시간, 토큰 수, 오류 코드만 남긴다.
- 업로드 파일은 임시 폴더에 쓰고 처리 후 지운다. 파일 이름은 신뢰하지 않는다(경로로 쓰지 않는다).
- 비밀번호·토큰·API 키·서버 주소는 코드·문서·커밋·이슈에 적지 않는다. `.env.example`에는 키 이름만 둔다.
- 의존성은 필요한 만큼만 추가한다.

## 11. 배포 (종섭이 서버에서 한다)

이진호가 준비해서 넘길 것:
- 빌드되는 `Dockerfile`: 멀티 스테이지, 비루트 사용자, `PORT` 환경변수, `HEALTHCHECK`(`/api/chat/health`)
- `.env.example`(키 이름만)과 필요한 환경변수 설명
- DB 스키마 SQL(`schema.sql`)과 적용 방법

서버 작업(compose, `/srv/chatbot/`, 같은 Docker 네트워크 연결, 메모리 제한)은 이종섭이 한다. 서버 DB 비밀번호는 이진호에게 전달하지 않아도 된다.

## 12. 완료 기준

- 규격(`docs/ai-integration.md` 3장)과 2장의 차이를 반영한 엔드포인트 5개(`chat`, 인제스트, 목록, 삭제, `health`)가 동작한다.
- 위 9장의 세 테스트와 인제스트·삭제 테스트가 통과한다.
- 가상 매뉴얼로 평가 질문을 돌려 결과를 ADR에 기록했다.
- `Dockerfile`로 이미지가 빌드되고 컨테이너로 `health`가 `ok`를 돌려준다.
- LMS의 `USE_AI_MOCK=false` 상태에서 질문이 답변된다(연동 확인은 이종섭과 함께).

## 13. 진행 공유와 Claude에게 시키는 방법

- **진행 상황과 질문은 `docs/sync-status.md`로 공유한다.** 막히거나 정해야 할 것은 그 문서의 "질문" 칸에 적는다.
- 서비스 레포에도 `AGENTS.md`(또는 `CLAUDE.md`)를 두고 아래 규칙을 적어 두면 Claude가 같은 방식으로 일한다.
  - 시작할 때 이 가이드와 `docs/ai-integration.md`를 읽는다.
  - `.env`를 열거나 출력하지 않는다. 키 이름만 확인한다.
  - 한 번에 한 단계씩 진행하고, 큰 로그는 `tail -n 20`으로 자른다.
  - 기능이 규격과 다르게 되면 코드를 바꾸기 전에 질문 칸에 적는다.
  - 서버·운영 DB·다른 사람의 설정은 건드리지 않는다.
