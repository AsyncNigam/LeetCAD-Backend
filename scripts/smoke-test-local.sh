#!/usr/bin/env bash
set -e

# ── Colors ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

API_BASE="http://localhost:3000"

info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
ok()    { echo -e "${GREEN}[  OK]${NC}  $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $1"; exit 1; }

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     LeetCAD Local E2E Smoke Test                ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ── Step 1: Docker daemon ─────────────────────────────────────
info "Checking Docker daemon..."
if docker info > /dev/null 2>&1; then
  ok "Docker is running."
else
  fail "Docker is NOT running. Start Docker Desktop and retry."
fi

# ── Step 2: Port checks ──────────────────────────────────────
check_port() {
  local name=$1
  local port=$2
  if nc -z localhost "$port" 2>/dev/null || (echo > /dev/tcp/localhost/"$port") 2>/dev/null; then
    ok "$name is listening on port $port."
  else
    fail "$name is NOT reachable on port $port."
  fi
}

info "Checking infrastructure ports..."
check_port "PostgreSQL"  5432
check_port "Redis"       6379
check_port "RabbitMQ"    5672
check_port "MinIO (S3)"  9000
check_port "Core API"    3000
check_port "Realtime WS" 3001

# ── Step 3: Dev Login (JWT extraction) ────────────────────────
info "Authenticating via /api/auth/dev-login..."

LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "${API_BASE}/api/auth/dev-login" \
  -H "Content-Type: application/json" \
  -d '{}')

HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -1)
BODY=$(echo "$LOGIN_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -ne 200 ] && [ "$HTTP_CODE" -ne 201 ]; then
  fail "Dev login returned HTTP $HTTP_CODE. Body: $BODY"
fi

# Extract JWT — try jq first, fall back to grep
if command -v jq &> /dev/null; then
  TOKEN=$(echo "$BODY" | jq -r '.accessToken')
else
  TOKEN=$(echo "$BODY" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
fi

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  fail "Could not extract JWT from login response. Body: $BODY"
fi

ok "Authenticated. JWT: ${TOKEN:0:20}..."

# ── Step 4: Presigned URL request ────────────────────────────
info "Requesting presigned upload URL via /api/storage/presigned-url..."

PRESIGN_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "${API_BASE}/api/storage/presigned-url" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{"filename": "smoke-test.step", "contentType": "application/octet-stream"}')

PRESIGN_CODE=$(echo "$PRESIGN_RESPONSE" | tail -1)
PRESIGN_BODY=$(echo "$PRESIGN_RESPONSE" | sed '$d')

if [ "$PRESIGN_CODE" -ne 200 ] && [ "$PRESIGN_CODE" -ne 201 ]; then
  fail "Presigned URL request returned HTTP $PRESIGN_CODE. Body: $PRESIGN_BODY"
fi

if command -v jq &> /dev/null; then
  UPLOAD_URL=$(echo "$PRESIGN_BODY" | jq -r '.url')
else
  UPLOAD_URL=$(echo "$PRESIGN_BODY" | grep -o '"url":"[^"]*"' | cut -d'"' -f4)
fi

if [ -z "$UPLOAD_URL" ] || [ "$UPLOAD_URL" = "null" ]; then
  fail "Could not extract presigned URL from response. Body: $PRESIGN_BODY"
fi

ok "Presigned URL obtained: ${UPLOAD_URL:0:60}..."

# ── Final Result ──────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║  ✅ Stack is healthy and API routes are responsive              ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Summary:${NC}"
echo -e "  • Docker:            ${GREEN}Running${NC}"
echo -e "  • Infrastructure:    ${GREEN}All ports listening${NC}"
echo -e "  • Auth (dev-login):  ${GREEN}JWT issued${NC}"
echo -e "  • Storage (presign): ${GREEN}URL generated${NC}"
echo ""
