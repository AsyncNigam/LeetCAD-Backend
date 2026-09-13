# ─────────────────────────────────────────────────────────────
# LeetCAD Assessment Engine — Multi-Stage Dockerfile
# Hybrid TypeScript/Python worker with headless CadQuery + PyVista
# ─────────────────────────────────────────────────────────────

# ════════════════════════════════════════════════════════════
# Stage 1 — Node.js Builder
# ════════════════════════════════════════════════════════════
FROM node:20-bookworm-slim AS builder

WORKDIR /build

# 1a. Copy workspace root manifests for layer-cached npm ci
COPY package.json package-lock.json turbo.json tsconfig.base.json ./

# 1b. Copy only the package.json files needed by the dependency graph
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/assessment-engine/package.json apps/assessment-engine/

# 1c. Install all workspace dependencies (deterministic, from lockfile)
RUN npm ci

# 1d. Copy source for shared-types and build first (dependency of assessment-engine)
COPY packages/shared-types/ packages/shared-types/
RUN npm run build --workspace=@leetcad/shared-types

# 1e. Copy assessment-engine source and build
COPY apps/assessment-engine/ apps/assessment-engine/
RUN npm run build --workspace=@leetcad/assessment-engine

# 1f. Prune devDependencies for a leaner production node_modules
RUN npm prune --production


# ════════════════════════════════════════════════════════════
# Stage 2 — Headless Runtime
# ════════════════════════════════════════════════════════════
FROM debian:bookworm-slim AS runtime

LABEL maintainer="LeetCAD Team"
LABEL description="Assessment engine: Node.js AMQP consumer + CadQuery/PyVista headless Python sandbox"

# Prevent interactive prompts during apt installs
ENV DEBIAN_FRONTEND=noninteractive

# 2a. Install system dependencies in a single layer
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Headless display (virtual framebuffer)
    xvfb \
    xauth \
    # OpenGL / Mesa runtime for PyVista off-screen rendering
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    libglu1-mesa \
    libegl1-mesa \
    libxkbcommon0 \
    # Python runtime
    python3 \
    python3-pip \
    python3-venv \
    # Essentials
    curl \
    ca-certificates \
    tini \
  && rm -rf /var/lib/apt/lists/*

# 2b. Install Node.js 20 LTS runtime into the Debian base
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*

# 2c. Set up Python virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

# 2d. Install Python dependencies (layer-cached separately from app code)
COPY apps/assessment-engine/src/sandbox/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir --upgrade pip \
  && pip install --no-cache-dir -r /tmp/requirements.txt \
  && rm /tmp/requirements.txt

# 2e. Create non-root application user
RUN groupadd --gid 1001 leetcad \
  && useradd --uid 1001 --gid 1001 --create-home --shell /bin/bash leetcad

WORKDIR /app

# 2f. Copy production node_modules from builder
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/packages/shared-types/dist ./node_modules/@leetcad/shared-types/dist
COPY --from=builder /build/packages/shared-types/package.json ./node_modules/@leetcad/shared-types/package.json

# 2g. Copy compiled assessment-engine
COPY --from=builder /build/apps/assessment-engine/dist ./dist
COPY --from=builder /build/apps/assessment-engine/package.json ./package.json

# 2h. Copy Python sandbox scripts
COPY apps/assessment-engine/src/sandbox/ ./sandbox/

# 2i. Create temp directories for CAD processing
RUN mkdir -p /tmp/leetcad-workdir && chown leetcad:leetcad /tmp/leetcad-workdir

# 2j. Entrypoint script with Xvfb and signal handling
COPY <<'ENTRYPOINT_SCRIPT' /app/entrypoint.sh
#!/usr/bin/env bash
set -euo pipefail

# ── Graceful shutdown ──────────────────────────────
cleanup() {
  echo "[entrypoint] Received shutdown signal, forwarding to PID $NODE_PID..."
  kill -TERM "$NODE_PID" 2>/dev/null || true
  wait "$NODE_PID" 2>/dev/null || true
  echo "[entrypoint] Shutdown complete."
  exit 0
}

trap cleanup SIGTERM SIGINT

# ── Start virtual framebuffer ──────────────────────
echo "[entrypoint] Starting Xvfb virtual display :99"
Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp &
XVFB_PID=$!
export DISPLAY=:99

# Give Xvfb a moment to initialize
sleep 0.5

# Verify Xvfb started
if ! kill -0 "$XVFB_PID" 2>/dev/null; then
  echo "[entrypoint] ERROR: Xvfb failed to start"
  exit 1
fi

echo "[entrypoint] Xvfb running on :99 (PID $XVFB_PID)"

# ── Launch Node.js assessment engine ───────────────
echo "[entrypoint] Starting assessment-engine worker..."
node dist/index.js &
NODE_PID=$!

# Wait for the Node.js process (or signal handler)
wait "$NODE_PID"
EXIT_CODE=$?

echo "[entrypoint] Node process exited with code $EXIT_CODE"
exit $EXIT_CODE
ENTRYPOINT_SCRIPT

RUN chmod +x /app/entrypoint.sh

# 2k. Switch to non-root user
USER leetcad

# 2l. Environment defaults
ENV NODE_ENV=production
ENV DISPLAY=:99

# Use tini as PID 1 for proper signal forwarding
ENTRYPOINT ["tini", "--"]
CMD ["/app/entrypoint.sh"]
