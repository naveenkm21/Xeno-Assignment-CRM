FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json .npmrc ./
COPY apps/channel/package.json apps/channel/
COPY packages/types/package.json packages/types/
RUN pnpm install --filter=@xeno/channel... --frozen-lockfile=false

FROM base AS build
COPY --from=deps /repo/node_modules ./node_modules
COPY tsconfig.base.json ./
COPY packages/types packages/types
COPY apps/channel apps/channel
RUN pnpm --filter=@xeno/channel build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/channel/dist ./dist
COPY --from=build /repo/apps/channel/package.json ./
COPY --from=build /repo/packages/types ./node_modules/@xeno/types
COPY --from=deps /repo/node_modules ./node_modules
EXPOSE 4000
CMD ["node", "dist/index.js"]
