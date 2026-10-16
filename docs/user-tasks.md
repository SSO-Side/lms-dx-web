# 사람이 하는 일 (사용자 작업 지침)

에이전트가 직접 하지 않고 사람이 해야 하는 일을 한곳에 모았습니다. 규칙의 근거는 `CLAUDE.md` 4절이고, 진행 상황은 `docs/PROGRESS.md`의 "막힘·확인 필요"에 한 줄씩 남깁니다.
에이전트는 이 항목에서 명령이나 절차만 한 번 제시하고 멈추며, 그 출력은 `[사용자 작업]`으로 시작합니다.

> 비밀값(`.env` 값, 비밀번호, 토큰)은 이 문서·채팅·커밋 어디에도 적지 않습니다. 이 문서에는 **키 이름**만 씁니다.

## 1. 개발 환경 준비 (처음 한 번)

### 1-1. DB 만들기
MariaDB에 앱 DB와 **섀도 DB**(`prisma migrate dev`용 빈 DB)를 만들고, 같은 계정에 두 DB 권한만 줍니다.

```sql
CREATE DATABASE lms_kdt CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE lms_kdt_shadow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'lms_kdt'@'localhost' IDENTIFIED BY '<비밀번호>';
GRANT ALL PRIVILEGES ON lms_kdt.* TO 'lms_kdt'@'localhost';
GRANT ALL PRIVILEGES ON lms_kdt_shadow.* TO 'lms_kdt'@'localhost';
```

### 1-2. `.env` 작성
`.env.example`을 복사해 값을 채웁니다. `.env`는 git에 올리지 않습니다.

| 키 | 넣을 값 |
| :-- | :-- |
| `DATABASE_URL` · `SHADOW_DATABASE_URL` | 1-1에서 만든 DB 접속 주소 (`mysql://…`) |
| `APP_BASE_URL` | 앱 기준 주소 (개발: `http://localhost:3333`) |
| `SESSION_SECRET` | 충분히 긴 난수 |
| `TZ` | `Asia/Seoul` |
| `STORAGE_DIR` | 업로드 파일 저장 폴더. 비우면 `.storage`. 운영에서는 **웹 루트 밖** 경로 (Docker는 볼륨 마운트 경로, 예: `/data/storage`) |
| `STORAGE_DRIVER` | 저장소 드라이버. 비우면 `local`(지금은 이것만 있음). 오브젝트 저장소로 옮길 때 드라이버 추가 후 변경 |
| `STORAGE_ACCEL_PREFIX` | 선택. 예: `/_files`. 넣으면 권한 확인 후 Nginx가 파일을 직접 전송(X-Accel-Redirect). 아래 Nginx `location`과 함께만 설정 |
| `USE_AI_MOCK` | 개발 중에는 `true` |
| `CHATBOT_API_URL` · `CHATBOT_SERVICE_TOKEN` · `INTERVIEW_API_URL` · `INTERVIEW_SERVICE_TOKEN` | AI 서비스 연동 때만 (`docs/ai-integration.md`) |
| `ALLOW_SEED` · `SEED_PASSWORD` | 개발 DB에서만. `ALLOW_SEED=true`, 가상 계정 공통 비밀번호(8자 이상) |
| `MARKET_INDEXABLE` | 마켓플레이스 검색 노출 허용. 기본은 비워 둠(noindex). 운영에서 공개를 결정했을 때만 `true` |

### 1-3. 스키마 반영과 가상 데이터

```bash
npm install
```

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

- 시드는 이미 시드된 DB에서는 기본 데이터를 건너뛰고, 빠진 모듈 데이터(M7 서류, M5 팀, M10 쇼케이스)만 보충합니다.
- **M7 서류 PDF 열람 확인용**: `STORAGE_DIR`(기본 `.storage`) 아래 `seed/sample-resume.pdf`에 가상 PDF 1개를 직접 둡니다. 없으면 시드 서류를 열 때 "파일을 찾을 수 없습니다"가 나옵니다(화면 흐름은 정상).
- M10 쇼케이스 이미지는 시드가 단색 PNG를 직접 만듭니다. 따로 할 일 없습니다.

## 2. 화면 눈으로 확인하기
에이전트는 로그인 비밀번호(`.env`)를 읽지 않으므로 로그인 후 화면은 사람이 확인합니다. 가상 계정은 `README.md` 1절에 있습니다.

| 모듈 | 확인할 흐름 |
| :-- | :-- |
| M7 서류 | `s04` 서류 추가(PDF·AI 동의) → 첨삭 요청 → `inst_a` 서류·프로젝트 > 서류에서 코멘트·수정 요청 → `s04` 새 버전 → `mgr_a` 서류 현황(파일 링크 없음 확인) |
| M5 팀 프로젝트 | `inst_a` 팀 만들기 → `s07` 체크포인트·기획안·주간 로그 → `inst_a` 피드백·단계 승인 → 홈 "팀 현황"의 지연 팀 |
| M10 쇼케이스 | `s08` 3팀 쇼케이스 탭에서 동의 → `inst_a` 쇼케이스 탭 검토 완료 → `mgr_a` 공개 승인 → 로그아웃 상태로 `/market`에 나타나는지 → 상세에서 커피챗 문의 → `mgr_a` 기업 문의 화면·홈 "신규 문의" |
| 공통 | 360px 모바일 폭에서 수강생 하단 탭(4개 + 더보기), 드로어가 아래에서 올라오는지 |

**미팅 자료용 스크린샷**: 랜딩 · `/market` 목록·상세·문의 모달 · 수강생 홈(내 서류·내 팀 위젯) · 수강생 내 서류·쇼케이스 탭 · 강사 서류 첨삭·쇼케이스 검토 드로어 · 매니저 서류 현황·공개 승인 드로어·기업 문의 화면.

## 3. 운영 서버 배포 (임시 서버, PRD 5.6)

| 항목 | 할 일 |
| :-- | :-- |
| DB | 운영 DB 생성·권한 (1-1과 같고 섀도 DB는 불필요), 스키마 반영은 `npx prisma migrate deploy`만. 시드는 운영에서 실행하지 않음 |
| 앱 실행 | `npm run build` 후 pm2 또는 systemd로 `npm run start` (포트 3333) |
| Nginx | 리버스 프록시 + TLS. 아래 설정 두 줄은 **필수** |
| 파일 | `STORAGE_DIR`를 웹 루트 밖에 두고, 앱 계정만 읽기·쓰기. Docker면 named volume 또는 호스트 경로를 마운트해 컨테이너 교체 후에도 유지 |
| 백업 | DB 일일 덤프 + `STORAGE_DIR` 폴더를 서버 밖에 보관, 복구 리허설 1회 |
| 방화벽·도메인 | 3333 포트는 외부에 열지 않고 Nginx만 노출, 서브도메인 연결. 세션 쿠키는 host-only라 별도 설정 없음 |

```nginx
# 기업 문의 요청 제한이 IP 기준이라, 클라이언트가 보낸 값을 덮어써야 위조를 막는다 ($proxy_add_x_forwarded_for 쓰지 않기)
proxy_set_header X-Forwarded-For $remote_addr;
# 업로드 한도: 서버 액션 32MB(next.config)와 맞춤 (증빙 3개·서류 PDF 10MB·이미지 5MB·자료/과제 20MB)
client_max_body_size 32m;
```

**Docker + Nginx에서 파일 전달을 Nginx에 맡길 때(선택)**: 앱 컨테이너와 Nginx가 같은 저장 볼륨을 마운트하고(Nginx는 읽기 전용), `.env`에 `STORAGE_ACCEL_PREFIX=/_files`를 넣습니다. 앱이 권한을 확인한 뒤 Nginx가 내려주므로 큰 파일도 Node를 거치지 않습니다. 설정하지 않으면 앱이 직접 전송합니다(동작 동일).

```nginx
# 외부에서 직접 열 수 없고(internal), 앱 응답의 X-Accel-Redirect로만 접근
location /_files/ {
    internal;
    alias /data/storage/;   # 앱의 STORAGE_DIR와 같은 볼륨
    add_header X-Content-Type-Options nosniff always;
}
```

## 4. 외부 서비스·키
- AI 서비스(챗봇·면접 질문) 주소·토큰 발급과 `.env` 반영, 준비되면 `USE_AI_MOCK=false` (`docs/ai-integration.md` 6절).
- 이메일 알림은 아직 없습니다. 기업 문의는 매니저가 문의 화면과 홈 위젯에서 확인합니다.

## 5. 학원과 협의할 것 (`[TBD]`)
정해지면 에이전트에게 값만 알려 주면 됩니다(코드는 설정값 자리만 있음).

- 출결: 지각·조퇴 합산 여부, 병결·휴가 제한값, 등급 임계값, 외출 계산 (지금은 기본값, 반 설정에서 수정)
- 팀 프로젝트: 마일스톤의 학원 공식 권장 여부, 반 시작·종료일 확정(지연 판정 기준)
- 마켓플레이스: 검색 노출 여부(`MARKET_INDEXABLE`), 문의 응대 담당자, B2B 아웃바운드 운영 절차
- 개인정보: 보관 기간, 학원·팀 간 처리 책임 범위, 실데이터 투입 시점 (협의 전에는 가상 데이터만)
- 자료: 학원 규정 PDF, 실제 명부 CSV (에이전트는 CSV 헤더 형식과 검증 코드만 제공)

## 6. 에이전트가 하지 않는 일 (필요하면 사람이 실행)
- `npx prisma migrate reset`, `db push --force-reset`, 테이블 DROP: 개발 DB를 비울 때만, 사람이 직접 실행합니다.
- `git push`, 원격 저장소·브랜치 보호 설정. (로컬 커밋은 테스트 통과 시 에이전트가 함)
- Node·전역 도구 설치, Prisma Studio로 데이터 확인.
