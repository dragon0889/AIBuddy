# CHƯA được build/kiểm thử trong môi trường phát triển (không có Docker) – cần kiểm tra trên CI/máy có Docker.
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/content/package.json packages/content/
RUN pnpm install --frozen-lockfile --filter @aibuddy/api...
COPY packages/shared packages/shared
COPY packages/content packages/content
COPY apps/api apps/api
COPY content content
ENV NODE_ENV=production CONTENT_DIR=/repo/content
USER node
EXPOSE 3001
CMD ["pnpm", "--filter", "@aibuddy/api", "exec", "tsx", "src/main.ts"]
