FROM node:22-alpine

# pnpm via corepack — pinned to match the workspace.
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

WORKDIR /app

# Workspace skeleton first — better Docker layer caching: deps only re-install
# when package manifests change, not when source changes.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY apps/channel/package.json apps/channel/
COPY packages/types/package.json packages/types/

# Install only what the channel service needs.
RUN pnpm install --filter=@xeno/channel... --frozen-lockfile=false --prod=false

# Now bring in source.
COPY tsconfig.base.json ./
COPY packages/types packages/types
COPY apps/channel apps/channel

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

WORKDIR /app/apps/channel
CMD ["pnpm", "start"]
