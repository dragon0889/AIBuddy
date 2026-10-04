# CHƯA được build/kiểm thử trong môi trường phát triển (không có Docker).
FROM node:22-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter @aibuddy/web...
RUN pnpm --filter @aibuddy/web build

FROM node:22-slim
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NODE_ENV=production
RUN corepack enable
WORKDIR /repo
COPY --from=build /repo /repo
USER node
EXPOSE 3000
CMD ["pnpm", "--filter", "@aibuddy/web", "exec", "next", "start", "-p", "3000"]
