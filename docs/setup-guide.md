# 처음 시작하기: 설치 → DB → 마이그레이션 → 실행 → 빌드

개발이 처음인 팀원(이진호, 정명주)이 **빈 PC에서 LMS를 띄우기까지** 따라 하는 안내서입니다. 위에서부터 순서대로 하면 됩니다.
규칙과 폴더 구조는 `docs/dev-guide.md`, 서버 배포는 `docs/user-tasks.md` 3절을 봅니다.

> 비밀번호·토큰은 이 문서, 채팅, 커밋 어디에도 적지 않습니다. `.env` 파일은 git에 올라가지 않습니다(`.gitignore`).
> 명령은 **터미널**(Windows는 PowerShell 또는 VS Code 터미널)에서 입력합니다. 줄 앞의 `$`는 입력하지 않습니다.

## 0. 먼저 설치할 것

| 도구 | 용도 | 확인 명령 |
| :-- | :-- | :-- |
| Git | 코드 내려받기·저장 | `git --version` |
| Node.js 22 (LTS) | 앱 실행. 서버 이미지가 22라서 같은 버전을 씁니다 | `node -v` → `v22.x.x` |
| Docker Desktop | 내 PC에 DB를 띄웁니다 (Windows는 WSL2 사용 옵션을 켠 채 설치) | `docker --version` |
| VS Code | 편집기 | |

Docker Desktop은 **실행 중(고래 아이콘이 떠 있는 상태)** 이어야 합니다.

## 1. 코드 받기와 패키지 설치

```bash
git clone <저장소 주소> lms-dx-web
cd lms-dx-web
npm ci
```

- `npm ci`는 `package-lock.json`에 적힌 버전 그대로 설치합니다(처음엔 `npm install` 대신 이것을 씁니다). 몇 분 걸립니다.
- 저장소 주소와 접근 권한은 이종섭에게 받습니다.

## 2. 내 PC에 DB 만들기 (Docker)

서버 DB에 접속하지 않고 **각자 PC의 DB**를 씁니다. 그래야 서로의 데이터를 망가뜨리지 않습니다.

1. 작업 폴더 밖(예: 바탕화면에 `lms-db` 폴더)에 `docker-compose.yml` 파일을 만들고 아래를 붙여 넣습니다. 비밀번호 두 곳(`로컬루트비번`, `로컬앱비번`)은 **본인이 정한 임의의 값**으로 바꿉니다.

```yaml
services:
  db:
    image: mariadb:11.8
    container_name: lms-db
    restart: unless-stopped
    environment:
      MARIADB_ROOT_PASSWORD: 로컬루트비번
      MARIADB_DATABASE: lms_kdt
      MARIADB_USER: lms_kdt
      MARIADB_PASSWORD: 로컬앱비번
    ports:
      - "127.0.0.1:3306:3306"
    volumes:
      - lms-db-data:/var/lib/mysql
    command:
      - --character-set-server=utf8mb4
      - --collation-server=utf8mb4_unicode_ci
volumes:
  lms-db-data:
```

2. 그 폴더에서 실행합니다.

```bash
docker compose up -d
docker compose ps        # lms-db 가 running 이면 성공
```

- DB 이름 `lms_kdt`와 계정 `lms_kdt`가 자동으로 만들어집니다. 이미 3306을 쓰는 프로그램이 있으면 `"127.0.0.1:3308:3306"`처럼 앞 번호만 바꾸고, 아래 `.env`의 포트도 같은 번호로 맞춥니다.
- PC를 껐다 켜면 Docker Desktop을 먼저 실행하면 DB도 다시 올라옵니다. 데이터는 `lms-db-data` 볼륨에 남습니다.
- **데이터를 전부 지우고 처음부터** 하고 싶을 때만: `docker compose down -v` (되돌릴 수 없음).

## 3. `.env` 만들기

저장소 폴더에서 예시 파일을 복사합니다.

```bash
cp .env.example .env          # PowerShell이면: Copy-Item .env.example .env
```

`.env`를 열어 **아래 세 개만** 채우고 나머지는 그대로 둡니다.

| 키 | 넣을 값 |
| :-- | :-- |
| `DATABASE_URL` | `"mysql://lms_kdt:로컬앱비번@127.0.0.1:3306/lms_kdt"` (2단계에서 정한 비밀번호) |
| `SESSION_SECRET` | 길고 임의의 문자열. 생성: `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` 출력값 |
| `SEED_PASSWORD` | 가상 계정 공통 로그인 비밀번호(8자 이상). 아무 값이나 정하되 기억해 둡니다 |

- 비밀번호에 `@ : / # ?` 같은 특수문자가 있으면 주소가 깨집니다. **영문·숫자만** 쓰세요.
- `USE_AI_MOCK="true"`는 그대로 둡니다. AI 서버 없이 가짜 응답으로 화면이 동작합니다.
- `ALLOW_SEED`는 평소 `"false"`입니다. 시드를 돌릴 때만 바꿉니다(5단계).

## 4. 마이그레이션: DB에 표 만들기

마이그레이션은 "DB 표 구조를 어떻게 만들어 왔는지"의 기록입니다(`prisma/migrations/` 폴더의 SQL들). 이것을 순서대로 DB에 적용하면 표가 만들어집니다.

```bash
npm run db:migrate        # = prisma migrate deploy: 아직 적용 안 된 마이그레이션을 순서대로 적용
npx prisma generate       # 코드가 쓰는 DB 도구(Prisma Client)를 만듭니다. npm ci 직후 한 번, 스키마가 바뀔 때마다 실행
```

- 끝에 `All migrations have been successfully applied`가 나오면 성공입니다.
- 이 프로젝트는 `prisma migrate dev`(표를 자동으로 고치는 명령)를 **쓰지 않습니다**. 개발자 계정에 임시 DB를 만들 권한이 없어서 그렇게 정했습니다. 항상 `db:migrate`만 씁니다.
- 새 마이그레이션이 팀원에게서 들어오면(`git pull` 후) 다시 `npm run db:migrate`와 `npx prisma generate`를 실행합니다.

**자주 나오는 오류**

| 오류 | 원인과 해결 |
| :-- | :-- |
| `Can't reach database server at 127.0.0.1:3306` | Docker가 꺼져 있거나 DB 컨테이너가 안 떠 있음. `docker compose ps`로 확인하고 `docker compose up -d` |
| `Authentication failed` / `Access denied` | `.env`의 계정·비밀번호·DB 이름이 2단계와 다름. 오타와 특수문자를 확인 |
| `Environment variable not found: DATABASE_URL` | `.env`가 없거나 저장소 루트가 아닌 곳에서 실행함 |
| `P3009` / `failed migration` | 중간에 실패한 기록이 남음. 혼자 해결하지 말고 오류 전문을 이종섭에게 전달 |
| `drift detected` 등 `reset` 권유 | **`migrate reset`에 `y`를 누르지 마세요.** 데이터가 모두 지워집니다. 먼저 물어봅니다 |

## 5. 가상 데이터(시드) 넣기: 내 PC DB에서만

로그인해 보려면 가상 학원·반·계정이 필요합니다. 시드가 만들어 줍니다.

1. `.env`에서 `ALLOW_SEED="true"`로 바꿉니다(`SEED_PASSWORD`는 3단계에서 채운 상태).
2. 실행합니다.
   ```bash
   npx prisma db seed
   ```
3. 끝나면 **바로 `.env`의 `ALLOW_SEED`를 `"false"`로 되돌립니다.**

- 시드는 **내 PC DB에서만** 돌립니다. 서버 DB에 대고 돌리지 않습니다.
- 계정 목록(`acad_admin`, `mgr_a`, `inst_a`, `s01`~`s08` 등)은 `README.md` 1절에 있고, 비밀번호는 3단계의 `SEED_PASSWORD` 값입니다.

## 6. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3333` 을 엽니다. 파일을 저장하면 화면이 자동으로 바뀝니다. 끄려면 터미널에서 `Ctrl + C`.

- 안 열리면 `npm run dev`를 실행한 터미널의 빨간 오류를 읽어 보세요. 대부분 `.env` 값 누락입니다.
- 3333 포트가 이미 사용 중이라는 오류가 나면 이전에 켜 둔 개발 서버가 있다는 뜻입니다. 그 터미널을 `Ctrl + C`로 끕니다.
- 정상 확인: `http://localhost:3333/api/health` 에 `{"ok":true}`가 나오고, `acad_admin`으로 로그인되면 됩니다.

## 7. 코드를 고친 뒤 확인 (커밋 전에 항상)

```bash
npm run lint
npx tsc --noEmit
npx vitest run
```

세 개 모두 오류 없이 끝나야 합니다. 테스트가 DB를 쓰는지는 `tests/`를 보고, 실패하면 오류 첫 줄을 복사해 질문 칸(`docs/sync-status.md`)에 적어 주세요.

## 8. 빌드(운영용 묶음)가 되는지 확인

배포 전에 한 번씩 실행해 봅니다.

```bash
# 개발 서버(npm run dev)를 먼저 끕니다. 켜 둔 채로 빌드하면 .next가 덮여 500 오류가 납니다.
npm run build
npm run start      # 운영 방식으로 실행. http://localhost:3333 확인 후 Ctrl + C
```

- `build`가 오류로 멈추면 대부분 타입 오류입니다. 7단계의 `npx tsc --noEmit`로 먼저 찾을 수 있습니다.
- 서버(Ubuntu + Docker)에 올리는 일은 이종섭이 합니다(`docs/user-tasks.md` 3-0절).

## 9. 스키마(표)를 고칠 때

`prisma/schema.prisma`를 고쳤다면 마이그레이션 파일을 **새로** 만들어야 합니다. 순서가 중요합니다.

1. `schema.prisma` 수정
2. 차이를 SQL로 뽑기. 폴더 이름은 `연월일시분초_짧은이름`
   ```bash
   npm run db:diff -- -o prisma/migrations/20261126120000_add_notice/migration.sql
   ```
   (폴더가 없으면 먼저 만듭니다. 파일이 이미 있는 마이그레이션은 **절대 수정하지 않습니다.**)
3. 만들어진 `migration.sql`을 열어 의도한 변경만 있는지 확인합니다. **`DROP`이 보이면 멈추고** 이종섭에게 묻습니다.
4. `npm run db:migrate` → `npx prisma generate`
5. 개발 DB를 SQL로 직접 고치지 않습니다(차이 계산이 어긋납니다).

## 10. 막혔을 때

1. 오류 메시지 **첫 줄과 실행한 명령**을 그대로 복사합니다(비밀번호가 들어간 줄은 지우고).
2. Claude에게 시킬 때는 "`CLAUDE.md`와 `docs/dev-guide.md`를 읽고 이 오류를 고쳐 줘"로 시작합니다.
3. 30분 넘게 같은 곳에서 막히면 `docs/sync-status.md`의 질문 칸에 적어 둡니다.

## 하면 안 되는 것 (요약)

- `npx prisma migrate reset`, `npx prisma migrate dev`, `db push --force-reset`, 테이블 DROP
- 서버 DB에 시드 실행, 운영 DB 직접 수정
- `.env` 내용을 채팅·커밋·스크린샷에 올리기
- 실제 수강생 개인정보로 테스트
