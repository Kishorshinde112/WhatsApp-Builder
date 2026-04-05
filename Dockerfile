# ===========================================
# WhatsApp Campaign Builder - Multi-stage Dockerfile
# ===========================================

FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY lib/db/package.json ./lib/db/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/dashboard/package.json ./artifacts/dashboard/
COPY scripts/package.json ./scripts/
RUN pnpm install --frozen-lockfile

# Build shared libraries
FROM deps AS builder
COPY . .
RUN pnpm run build

# API Server production image
FROM base AS api
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/artifacts/api-server ./artifacts/api-server
COPY --from=builder /app/package.json ./
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]

# Dashboard production image
FROM base AS dashboard
WORKDIR /app
RUN apk add --no-cache curl
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/artifacts/dashboard ./artifacts/dashboard
COPY --from=builder /app/package.json ./
ENV NODE_ENV=production
EXPOSE 3000
WORKDIR /app/artifacts/dashboard
CMD ["pnpm", "serve"]
