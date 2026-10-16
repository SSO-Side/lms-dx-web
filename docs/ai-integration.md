# AI 서비스 연동 가이드 (챗봇 M4 · 면접 질문 M8)

챗봇과 면접 질문 생성기를 LMS에 연결하기 위한 합의 문서입니다. **AI 서비스 개발자**(챗봇: 이진호, 면접 질문: 정명주·최주원)와 **LMS 개발자**(이종섭)가 함께 봅니다.
근거는 PRD의 M4, M8, 4장, 5.3절, 8.1절입니다. 이 문서와 PRD가 다르면 이 문서를 따르고, 바꿀 때는 양쪽이 합의한 뒤 이 문서부터 고칩니다.

- 작성일: 2026-10-16 · 상태: v0.1 (`[합의 필요]` 표시 항목은 미확정)

## 1. 구조와 원칙

```
브라우저 ──▶ LMS 서버 (Next.js: 로그인·권한·반 범위 검사, AI 어댑터 src/lib/ai/*)
                 ├──▶ 챗봇 서비스        POST /api/chat ...
                 └──▶ 면접 질문 서비스   POST /v1/interview/questions ...
                                            └──▶ 외부 LLM API
```

1. **서버 간 호출만** 합니다. 브라우저는 AI 서비스를 직접 부르지 않으므로 AI 서비스에 CORS 설정은 필요 없습니다.
2. **권한 판단은 LMS가 합니다.** LMS가 로그인·역할·반 접근을 확인한 뒤 `role`과 `cohortId`를 넣어 호출합니다. AI 서비스는 받은 값을 믿고, 그 범위 안에서만 검색·응답합니다.
3. **구현 방식은 자유**입니다. 아래 HTTP 규격만 지키면 내부 모델·검색 방식이 바뀌어도 LMS는 고치지 않습니다. 선택 근거는 각 팀이 ADR로 남깁니다.
4. **날조 금지**입니다. 입력이나 문서에 없는 사실·수치를 만들지 않고, 근거가 없으면 모른다고 응답합니다.
5. **장애 격리**: AI 서비스가 죽거나 느려도 출결·티켓·자료 같은 LMS 핵심 기능은 그대로 동작해야 합니다.

## 2. 공통 규칙

| 항목 | 규칙 |
| :-- | :-- |
| 인증 | 모든 요청에 `Authorization: Bearer <SERVICE_TOKEN>`. 토큰이 없거나 틀리면 `401` |
| 형식 | `Content-Type: application/json; charset=utf-8` (문서 업로드만 `multipart/form-data`) |
| 요청 추적 | LMS가 `X-Request-Id: <uuid>` 헤더를 보냅니다. 응답과 서비스 로그에 같은 값을 남겨 주세요 |
| 타임아웃 | 챗봇 **30초**, 면접 질문 **60초**. LMS는 이 시간이 지나면 연결을 끊고 사용자에게 재시도를 안내합니다 |
| 오류 응답 | 아래 형식 + 알맞은 HTTP 상태 코드 |
| 버전 | 응답에 `engineVersion`을 넣습니다. LMS는 이 값을 결과와 함께 저장합니다 |
| 상태 확인 | 각 서비스는 인증 없이 부를 수 있는 health 엔드포인트를 둡니다 |
| 시간·날짜 | 일시는 ISO 8601(UTC, `Z`), 날짜만 쓸 때는 `YYYY-MM-DD` |

```json
// 오류 응답 (모든 엔드포인트 공통)
{ "error": { "code": "INVALID_REQUEST", "message": "question은 1~500자여야 합니다." } }
```

| HTTP | `error.code` | 의미 | LMS 동작 |
| :-- | :-- | :-- | :-- |
| 400 | `INVALID_REQUEST` | 필드 누락·형식 오류 | 오류 기록, 사용자에게 "요청을 처리할 수 없습니다" |
| 401 | `UNAUTHORIZED` | 서비스 토큰 오류 | 오류 기록 (설정 문제) |
| 404 | `NOT_FOUND` | 문서 등 대상 없음 | 목록 새로고침 |
| 413 | `PAYLOAD_TOO_LARGE` | 파일·입력이 너무 큼 | 크기 제한 안내 |
| 422 | `UNPROCESSABLE` | 형식은 맞지만 처리 불가 (예: 텍스트 없는 스캔 PDF) | `message`를 사용자에게 표시 |
| 429 | `RATE_LIMITED` | 호출 한도 초과 | 잠시 후 재시도 안내 |
| 500·503 | `INTERNAL` · `UNAVAILABLE` | 서비스 오류·점검 | 재시도 안내, 핵심 기능은 계속 동작 |

`message`는 사용자에게 그대로 보여 줄 수 있는 한국어 문장으로 써 주세요. 내부 스택 트레이스는 넣지 않습니다.

### 개인정보·로그 규칙 (PRD 8.1)

- 이력서 원문과 개인 식별 정보(이름·연락처·이메일)는 **로그에 남기지 않습니다.** 로그에는 요청 ID, 소요 시간, 토큰 수, 오류 코드만 남깁니다.
- 외부 LLM으로 보내기 전에 이름·연락처를 제거합니다. LMS 화면에는 외부 전송 고지·동의 문구를 둡니다.
- 챗봇 화면에는 "질문에 개인정보를 입력하지 마세요" 안내를 둡니다. 질의 로그 보관 기간은 `[합의 필요: 학원 협의]`입니다.
- 개발 단계에서는 가상 데이터와 합성 이력서만 씁니다. 실제 수강생 데이터는 G0 합의 이후에 씁니다.

## 3. 챗봇 API (M4)

기본 주소는 `CHATBOT_API_URL`입니다. 아래 경로는 그 뒤에 붙습니다.

| Method | Path | 설명 | LMS 쪽 권한 |
| :-- | :-- | :-- | :-- |
| POST | `/api/chat` | 질의응답 | `chat:ask` (모든 역할) |
| POST | `/api/chat/documents` | 문서 인제스트 | `chatDoc:manage` (매니저·학원 관리자) |
| GET | `/api/chat/documents` | 인제스트된 문서 목록 | `chatDoc:manage` |
| DELETE | `/api/chat/documents/{id}` | 문서 삭제 | `chatDoc:manage` |
| GET | `/api/chat/health` | 상태 (인증 없음) | — |

### 3.1 질의응답 `POST /api/chat`

```json
// 요청
{
  "sessionId": "8a1f…-uuid",
  "question": "공결 인정 기준이 뭐예요?",
  "role": "STUDENT",
  "cohortId": 3,
  "academyId": 1
}

// 응답 200
{
  "answer": "병결은 진단서 등 증빙을 제출하면 …",
  "sources": [{ "docId": 12, "title": "운영 매뉴얼", "page": 7 }],
  "grounded": true,
  "suggestedChips": ["출석 인정 기준", "장려금 지급일"],
  "engineVersion": "chat-v1.0"
}
```

| 필드 | 타입 | 규칙 |
| :-- | :-- | :-- |
| `sessionId` | string(uuid) | 같은 대화창의 연속 질문을 묶습니다. LMS가 대화창마다 만듭니다 |
| `question` | string | 1~500자. LMS가 앞뒤 공백을 지우고 보냅니다 |
| `role` | `STUDENT` \| `INSTRUCTOR` \| `MANAGER` \| `ACADEMY_ADMIN` | 질문자 역할. **문서 대상 필터에 사용** |
| `cohortId` | number | 질문자가 보고 있는 반. 반별 문서 + 학원 공통 문서만 검색합니다 |
| `academyId` | number | 학원 공통 문서 범위. `[합의 필요]` 여러 학원 운영 대비로 추가 제안 |
| `answer` | string | 답변. 근거가 없으면 아래 고정 문구 |
| `sources` | array | 근거 문서와 쪽수. `grounded:false`이면 빈 배열 |
| `grounded` | boolean | 근거 문서를 찾았는지 |
| `suggestedChips` | string[] | 선택. 다음 질문 추천(최대 5개) |

**규칙**
- **권한 분기 (필수)**: 문서 대상이 `STUDENT`면 학생만, `INSTRUCTOR`면 강사·매니저·학원 관리자, `ALL`이면 모두에게 검색됩니다. 강사 전용 문서가 학생 답변에 나오면 안 되며, 챗봇 쪽에 이 경우의 테스트가 반드시 있어야 합니다.
- **반 범위**: 문서의 `cohortId`가 비어 있으면 학원 공통 문서, 값이 있으면 그 반에서만 검색합니다. 요청의 `cohortId`와 다른 반 문서는 쓰지 않습니다.
- **근거 없음**: `grounded:false`이고 `answer`는 "확인할 수 없습니다. 담당자에게 문의하세요."로 합니다. LMS는 이때 [문의 등록] 버튼을 함께 보여 줍니다.
- `role`이 `ADMIN`(개발팀)인 호출은 LMS가 보내지 않습니다.

### 3.2 문서 인제스트 `POST /api/chat/documents` `[합의 필요]`

PRD에 형식이 없어 아래 형식을 제안합니다.

```
Content-Type: multipart/form-data
file      : PDF 파일 (최대 20MB 제안)
title     : "운영 매뉴얼"
audience  : STUDENT | INSTRUCTOR | ALL
cohortId  : 3        (비우면 학원 공통)
academyId : 1
```

```json
// 응답 201
{ "id": 12, "title": "운영 매뉴얼", "audience": "ALL", "cohortId": null, "pages": 24, "status": "READY", "createdAt": "2026-10-20T05:12:00Z" }
```

- 처리가 오래 걸리면 `status: "PROCESSING"`으로 먼저 응답하고, 목록 조회에서 `READY` 또는 `FAILED`로 바뀌게 합니다.
- `GET /api/chat/documents?academyId=1&cohortId=3`은 위 응답 형식의 배열을 돌려줍니다. LMS는 관리 화면에서 반별·공통 문서를 함께 보여 줍니다.
- `DELETE`는 성공 시 `204`입니다. 삭제한 문서는 이후 검색에서 바로 빠져야 합니다.

### 3.3 상태 `GET /api/chat/health`

```json
{ "status": "ok", "engineVersion": "chat-v1.0", "documents": 31 }
```

## 4. 면접 질문 API (M8)

기본 주소는 `INTERVIEW_API_URL`입니다.

| Method | Path | 설명 | LMS 쪽 권한 |
| :-- | :-- | :-- | :-- |
| POST | `/v1/interview/questions` | 질문·체크포인트 생성 | `resume:own`(본인), `resume:readOthers`(배정 강사) — M7·M8 작업 때 구현 |
| GET | `/v1/health` | 상태·엔진 버전 (인증 없음) | — |

### 4.1 질문 생성 `POST /v1/interview/questions`

```json
// 요청
{
  "requestId": "3c9e…-uuid",
  "resume": { "fileUrl": "https://lms.example/api/ai-files/…?token=…" },
  "targetRole": "백엔드 개발자",
  "questionCount": 10,
  "level": "junior"
}

// 응답 200
{
  "requestId": "3c9e…-uuid",
  "engineVersion": "api-v1.0",
  "questions": [
    {
      "id": "q1",
      "category": "METRIC_MISSING",
      "question": "목록 조회 속도를 개선했다고 하셨는데, 어떻게 측정했고 전후 값은 얼마였나요?",
      "basis": { "section": "projects[0]", "quote": "목록 속도 개선" },
      "checkpoints": ["측정 방법(도구·환경)을 설명한다", "개선 전후 수치를 제시한다", "원인과 개선 방법을 연결해 설명한다"],
      "followUps": ["데이터가 10배 늘면 어떻게 되나요?"]
    }
  ],
  "meta": { "latencyMs": 8200, "inputTokens": 2100, "outputTokens": 1300 }
}
```

| 필드 | 타입 | 규칙 |
| :-- | :-- | :-- |
| `requestId` | string(uuid) | LMS가 만들고, 응답에 그대로 돌려줍니다 |
| `resume.fileUrl` | string | LMS가 발급한 **서명된 임시 URL**. 만료 `[합의 필요: 5분 제안]`, 한 번 내려받으면 끝 |
| `targetRole` | string | 지원 직무 (자유 입력, 최대 50자) |
| `questionCount` | number | 1~20, 기본 10. 근거가 부족하면 더 적게 돌려줘도 됩니다 |
| `level` | `junior` | 지금은 `junior`만 씁니다 |
| `questions[].category` | 아래 코드 | 결손점 유형 |
| `questions[].basis.quote` | string | **이력서 텍스트에 실제로 있는 문장 조각** |
| `questions[].checkpoints` | string[] | 면접관용 평가 기준 2~5개 |
| `questions[].followUps` | string[] | 꼬리 질문 0~3개 |
| `meta` | object | 소요 시간·토큰 수 (로그·비용 확인용) |

**결손점 코드 (`category`)**

| 코드 | 의미 |
| :-- | :-- |
| `ROLE_UNCLEAR` | 팀 프로젝트에서 본인 기여가 불분명 |
| `METRIC_MISSING` | "개선했다"만 있고 수치·측정 방법이 없음 |
| `TECH_REASON_MISSING` | 기술 나열만 있고 선택 이유가 없음 |
| `TROUBLESHOOT_GAP` | 문제는 있으나 원인·해결 과정이 빠짐 |
| `SCOPE_VAGUE` | 규모·기간·사용자 범위가 모호함 |

코드를 추가하려면 이 문서에 먼저 추가한 뒤 사용합니다. LMS는 모르는 코드를 "기타"로 표시합니다.

**품질 규칙 (PRD 4.3)**
- **근거 검증**: 서비스가 `basis.quote`가 이력서 텍스트에 실제로 있는지 검사하고, 없으면 그 질문을 버립니다. LMS도 저장 전에 한 번 더 확인합니다.
- **사실 단정 금지**: 이력서에 없는 경험을 전제한 질문을 만들지 않습니다.
- **신입 눈높이**: 대규모 트래픽·운영 경험처럼 신입에게 기대하기 어려운 내용을 전제하지 않습니다.
- 한 번의 응답 안에 비슷한 질문이 겹치지 않게 합니다.
- 텍스트를 뽑을 수 없는 스캔본 PDF는 `422 UNPROCESSABLE`로 응답합니다 (스캔본 지원 여부 `[TBD]`).

### 4.2 상태 `GET /v1/health`

```json
{ "status": "ok", "engineVersion": "api-v1.0", "llmProvider": "reachable" }
```

## 5. LMS 쪽 구현 지침 (이종섭)

**환경 변수** (`.env`, 키 이름만 표시):

| 키 | 용도 |
| :-- | :-- |
| `USE_AI_MOCK` | `true`면 실제 서비스 대신 `src/lib/ai/mock.ts` 응답 사용 (개발 기본값) |
| `CHATBOT_API_URL` · `CHATBOT_SERVICE_TOKEN` | 챗봇 주소와 토큰 |
| `INTERVIEW_API_URL` · `INTERVIEW_SERVICE_TOKEN` | 면접 질문 서비스 주소와 토큰 |

> PRD 4.1의 `CHATBOT_BASE_URL`·`INTERVIEW_BASE_URL`은 코드(`src/lib/config.ts`)에서 `*_API_URL`로 정했습니다. 이 이름을 씁니다.

**파일 구성** (`src/lib/ai/`)

| 파일 | 역할 |
| :-- | :-- |
| `http.ts` | 공통 호출: 토큰 헤더, `X-Request-Id`, `AbortController` 타임아웃, 오류 형식 변환 |
| `chatbot.ts` | `ask()`, `listDocuments()`, `uploadDocument()`, `deleteDocument()` |
| `interview.ts` | `generateQuestions()` + `basis.quote` 재검증 |
| `mock.ts` | 위 규격과 똑같은 모양의 고정 응답 (`USE_AI_MOCK=true`일 때) |
| `types.ts` | 요청·응답 타입과 zod 스키마 (응답을 그대로 믿지 않고 검증) |

**규칙**
- 호출은 서버 액션·Route Handler에서만 합니다. 서버 액션 첫 줄은 `requireCohortAccess(cohortId, "chat:ask")`처럼 권한 검사이고, 요청 `cohortId`는 URL 경로 값만 씁니다.
- 응답은 zod로 검증하고, 형식이 다르면 `INTERNAL`로 처리합니다.
- 타임아웃·오류는 화면의 해당 위젯·패널에서만 표시하고, 페이지 전체를 막지 않습니다.
- 이력서 파일은 `src/lib/storage`에서 읽고, 짧게 만료되는 서명 URL Route(`/api/ai-files/...`)로만 내보냅니다. 영구 URL은 만들지 않습니다.
- 사용자별 일일 호출 한도와 같은 입력 결과 캐시를 둡니다. 한도 값은 `[합의 필요]`입니다.

## 6. 개발·검증 절차

1. **목 먼저**: LMS는 `USE_AI_MOCK=true`로 화면과 흐름을 먼저 만듭니다. AI 팀은 이 문서의 예시 JSON을 그대로 돌려주는 엔드포인트부터 띄웁니다.
2. **계약 확인**: AI 팀은 개발 서버 주소와 토큰을 LMS 담당자에게 전달합니다(메신저로, 저장소에 올리지 않음). LMS 담당자가 아래 명령으로 형식을 확인합니다.

```bash
curl -s -X POST "$CHATBOT_API_URL/api/chat" -H "Authorization: Bearer $CHATBOT_SERVICE_TOKEN" -H "Content-Type: application/json" -H "X-Request-Id: test-001" -d '{"sessionId":"00000000-0000-0000-0000-000000000001","question":"공결 인정 기준이 뭐예요?","role":"STUDENT","cohortId":1,"academyId":1}'
```

3. **필수 확인 항목**

| 항목 | 챗봇 | 면접 질문 |
| :-- | :-- | :-- |
| 토큰 없는 요청이 `401` | ✔ | ✔ |
| 오류가 공통 형식 `{ error: { code, message } }` | ✔ | ✔ |
| 응답에 `engineVersion` | ✔ | ✔ |
| 강사 전용 문서가 학생 질문에 안 나옴 | ✔ | — |
| 다른 반 문서가 안 나옴 | ✔ | — |
| 근거 없을 때 `grounded:false` + 고정 문구 | ✔ | — |
| 모든 질문의 `basis.quote`가 이력서에 실재 | — | ✔ |
| 타임아웃 안에 응답 (챗봇 30초, 면접 60초) | ✔ | ✔ |
| 로그에 이력서 원문·개인정보 없음 | ✔ | ✔ |

4. **전환**: 실서비스 준비가 끝나면 `.env`에서 `USE_AI_MOCK=false`로 바꾸고 주소·토큰을 넣습니다. `.env` 작성은 사람이 합니다.

## 7. 미정 사항

| 항목 | 현재 | 결정 주체 |
| :-- | :-- | :-- |
| 문서 인제스트 요청 형식·최대 크기 | 3.2절 제안 | 이진호 + 이종섭 |
| `academyId` 필드 추가 | 제안 (여러 학원 대비) | 이진호 + 이종섭 |
| 서명 URL 만료 시간 | 5분 제안 | 이종섭 |
| 사용자별 일일 호출 한도, 토큰 상한 | 미정 | 팀 |
| 면접 질문 응답 시간 목표 | 중앙값 30초 (PRD `[TBD]`) | 정명주·최주원 |
| 스캔본 PDF 지원 | 미정 (지원 전에는 422) | 정명주·최주원 |
| 질의 로그 보관 기간 | 학원 협의 | 학원 |
| 서비스 호스팅 | LMS와 같은 우분투 서버 예정 | 팀 |
