# ─────────────────────────────────────────────────────────────
# LeetCAD Core Platform — Multi-Stage Dockerfile
# NestJS / Fastify API server
# ─────────────────────────────────────────────────────────────

# ════════════════════════════════════════════════════════════
# Stage 1 — Builder
# ════════════════════════════════════════════════════════════
FROM node:20-bookworm-slim AS builder

WORKDIR /build

# 1a. Copy workspace root manifests for layer-cached npm ci
COPY package.json package-lock.json turbo.json tsconfig.base.json ./

# 1b. Copy only the package.json files needed by the dependency graph
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/core-platform/package.json apps/core-platform/

# 1c. Install all workspace dependencies (deterministic, from lockfile)
RUN npm ci

# 1d. Copy shared-types source and build first (workspace dependency)
COPY packages/shared-types/ packages/shared-types/
RUN npm run build --workspace=@leetcad/shared-types

# 1e. Copy core-platform source and build
COPY apps/core-platform/ apps/core-platform/
RUN npm run build --workspace=@leetcad/core-platform

# 1f. Prune devDependencies for a leaner production image
RUN npm prune --omit=dev


# ════════════════════════════════════════════════════════════
# Stage 2 — Production Runtime
# ════════════════════════════════════════════════════════════
FROM node:20-bookworm-slim AS runtime

LABEL maintainer="LeetCAD Team"
LABEL description="Core platform API — NestJS on Fastify"

# 2a. Install tini for PID 1 signal handling + curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    tini \
    curl \
  && rm -rf /var/lib/apt/lists/*

# 2b. Create non-root application user
RUN groupadd --gid 1001 leetcad \
  && useradd --uid 1001 --gid 1001 --create-home --shell /bin/bash leetcad

WORKDIR /app

# 2c. Copy production node_modules from builder
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/packages/shared-types/dist ./node_modules/@leetcad/shared-types/dist
COPY --from=builder /build/packages/shared-types/package.json ./node_modules/@leetcad/shared-types/package.json

# 2d. Copy compiled application
COPY --from=builder /build/apps/core-platform/dist ./dist
COPY --from=builder /build/apps/core-platform/package.json ./package.json

# 2e. Set ownership
RUN chown -R leetcad:leetcad /app

# 2f. Switch to non-root user
USER leetcad

# 2g. Environment
ENV NODE_ENV=production
EXPOSE 3000

# 2h. Healthcheck — probe the Swagger / API root
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api || exit 1

# 2i. Run with tini as PID 1
ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/main.js"]
