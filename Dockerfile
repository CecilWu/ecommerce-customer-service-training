# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && apt-get clean

FROM base AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

# 构建时只使用临时数据库和占位密钥；正式密钥由 docker.env 在运行时注入。
ENV DATABASE_URL="file:/tmp/build.db" \
    SESSION_SECRET="docker-build-only-session-secret-please-ignore" \
    AI_CONFIG_ENCRYPTION_KEY="docker-build-only-ai-encryption-key-ignore" \
    APP_URL="https://example.invalid" \
    NEXT_PUBLIC_APP_URL="https://example.invalid"

RUN npm run db:generate \
    && npm run db:push \
    && npm run check

FROM base AS runner
WORKDIR /app
ENV NODE_ENV="production" \
    PORT="3000" \
    HOSTNAME="0.0.0.0"

RUN apt-get update \
    && apt-get install -y --no-install-recommends gosu sqlite3 \
    && apt-get clean

COPY --from=builder --chown=node:node /app /app
RUN chmod 755 /app/docker/entrypoint.sh /app/docker/repair-sqlite-indexes.sh

EXPOSE 3000
ENTRYPOINT ["/app/docker/entrypoint.sh"]
