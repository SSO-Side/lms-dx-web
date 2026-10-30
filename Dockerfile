# 스테이징·운영 이미지. 단계: deps(설치) → build(빌드) → tools(마이그레이션·시드) / prod-deps → runner(실행)
# 사용법은 deploy/docker-compose.yml과 docs/user-tasks.md 참고.

FROM node:22-slim AS base
# Prisma 엔진이 openssl을 쓴다
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV TZ=Asia/Seoul NEXT_TELEMETRY_DISABLED=1

# 1) 의존성 설치 (package*.json이 안 바뀌면 캐시 재사용)
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

# 2) 빌드. 환경 변수 검사(src/lib/config.ts)를 통과시키는 빌드 전용 가짜 값이며, 실행 때는 deploy/.env 값을 쓴다.
FROM deps AS build
COPY . .
RUN npx prisma generate
RUN DATABASE_URL="mysql://build:build@localhost:3306/build" SESSION_SECRET="build-only" npm run build

# 3) 마이그레이션·시드용 (prisma CLI·tsx가 개발 의존성이라 실행 이미지와 분리)
FROM build AS tools
RUN mkdir -p /data/storage && chown -R node:node /data/storage
USER node
CMD ["npx", "prisma", "migrate", "deploy"]

# 4) 운영 의존성만 남기기 (생성된 Prisma 클라이언트 node_modules/.prisma는 유지된다)
FROM build AS prod-deps
RUN npm prune --omit=dev --no-audit --no-fund

# 5) 실행 이미지
FROM base AS runner
ENV NODE_ENV=production STORAGE_DIR=/data/storage
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/package.json /app/next.config.ts ./
COPY --from=build --chown=node:node /app/prisma ./prisma
RUN mkdir -p /data/storage && chown -R node:node /data/storage
USER node
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3333/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "start"]
