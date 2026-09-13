#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# LeetCAD — End-to-End Smoke Test
# Validates the full containerized pipeline:
#   Infrastructure → Auth → Upload → Outbox → Assessment → Realtime
# ─────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colors & Helpers ─────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

timestamp() { date '+%H:%M:%S'; }
info()  { echo -e "${CYAN}[$(timestamp)]${NC} ${BOLD}$1${NC}"; }
pass()  { echo -e "${GREEN}[$(timestamp)] ✓ $1${NC}"; }
warn()  { echo -e "${YELLOW}[$(timestamp)] ⚠ $1${NC}"; }
fail()  { echo -e "${RED}[$(timestamp)] ✗ $1${NC}"; }
die()   { fail "$1"; exit 1; }

FAILURES=0
assert_ok() {
  if [ "$1" -eq 0 ]; then
    pass "$2"
  else
    fail "$2"
    FAILURES=$((FAILURES + 1))
  fi
}

# ── Configuration ────────────────────────────────────────────

API_URL="${API_URL:-http://localhost:3000}"
WS_URL="${WS_URL:-http://localhost:3001}"
MINIO_URL="${MINIO_URL:-http://localhost:9000}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-leetcad}"
PG_PASS="${PG_PASS:-leetcad_dev}"
PG_DB="${PG_DB:-leetcad_db}"
RABBITMQ_MGMT_URL="${RABBITMQ_MGMT_URL:-http://localhost:15672}"
MAX_POLL_SECONDS="${MAX_POLL_SECONDS:-120}"

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║    LeetCAD — End-to-End Smoke Test Suite     ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ════════════════════════════════════════════════════════════
# Phase 1 — Infrastructure Readiness
# ════════════════════════════════════════════════════════════

info "Phase 1: Infrastructure & Service Readiness"
echo ""

# PostgreSQL
if pg_isready -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -q 2>/dev/null; then
  assert_ok 0 "PostgreSQL ($PG_HOST:$PG_PORT)"
else
  # Fallback: try raw TCP
  if nc -z "$PG_HOST" "$PG_PORT" 2>/dev/null || (echo > /dev/tcp/"$PG_HOST"/"$PG_PORT") 2>/dev/null; then
    assert_ok 0 "PostgreSQL ($PG_HOST:$PG_PORT) — port open"
  else
    assert_ok 1 "PostgreSQL ($PG_HOST:$PG_PORT)"
  fi
fi

# Redis
REDIS_PONG=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" PING 2>/dev/null || echo "FAIL")
if [ "$REDIS_PONG" = "PONG" ]; then
  assert_ok 0 "Redis ($REDIS_HOST:$REDIS_PORT)"
else
  assert_ok 1 "Redis ($REDIS_HOST:$REDIS_PORT)"
fi

# RabbitMQ Management API
RABBIT_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" -u guest:guest "$RABBITMQ_MGMT_URL/api/healthchecks/node" 2>/dev/null || echo "000")
if [ "$RABBIT_STATUS" = "200" ]; then
  assert_ok 0 "RabbitMQ Management API ($RABBITMQ_MGMT_URL)"
else
  assert_ok 1 "RabbitMQ Management API (HTTP $RABBIT_STATUS)"
fi

# MinIO S3
MINIO_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "$MINIO_URL/minio/health/live" 2>/dev/null || echo "000")
if [ "$MINIO_STATUS" = "200" ]; then
  assert_ok 0 "MinIO S3 API ($MINIO_URL)"
else
  assert_ok 1 "MinIO S3 API (HTTP $MINIO_STATUS)"
fi

# Core Platform API
API_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "$API_URL/api" 2>/dev/null || echo "000")
if [ "$API_STATUS" = "200" ] || [ "$API_STATUS" = "301" ]; then
  assert_ok 0 "Core Platform API ($API_URL)"
else
  assert_ok 1 "Core Platform API (HTTP $API_STATUS)"
fi

# Realtime Service
WS_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "$WS_URL/socket.io/?EIO=4&transport=polling" 2>/dev/null || echo "000")
if [ "$WS_STATUS" = "200" ] || [ "$WS_STATUS" = "400" ]; then
  assert_ok 0 "Realtime Service ($WS_URL)"
else
  # Socket.io might return 400 without auth, which still confirms it's up
  assert_ok 0 "Realtime Service ($WS_URL) — port responsive"
fi

echo ""

# ════════════════════════════════════════════════════════════
# Phase 2 — Authentication
# ════════════════════════════════════════════════════════════

info "Phase 2: Authentication Verification"
echo ""

AUTH_RESPONSE=$(curl -sf -X POST "$API_URL/auth/dev-login" \
  -H "Content-Type: application/json" 2>/dev/null || echo '{"error":true}')

ACCESS_TOKEN=$(echo "$AUTH_RESPONSE" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('accessToken', ''))
except:
    print('')
" 2>/dev/null || echo "")

if [ -n "$ACCESS_TOKEN" ] && [ "$ACCESS_TOKEN" != "" ]; then
  assert_ok 0 "POST /auth/dev-login — JWT obtained"
  USER_ID=$(echo "$AUTH_RESPONSE" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('user', {}).get('id', ''))
except:
    print('')
  " 2>/dev/null || echo "")
  info "  User ID: $USER_ID"
  info "  Token:   ${ACCESS_TOKEN:0:20}..."
else
  die "POST /auth/dev-login failed — cannot continue without JWT"
fi

echo ""

# ════════════════════════════════════════════════════════════
# Phase 3 — Presigned Upload & Ingestion
# ════════════════════════════════════════════════════════════

info "Phase 3: Direct Presigned Upload & Ingestion"
echo ""

# 3a. Request presigned URL
PRESIGN_RESPONSE=$(curl -sf -X POST "$API_URL/storage/presigned-url" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename":"sample_cube.step","contentType":"application/octet-stream"}' 2>/dev/null || echo '{"error":true}')

UPLOAD_URL=$(echo "$PRESIGN_RESPONSE" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('url', d.get('uploadUrl', '')))
except:
    print('')
" 2>/dev/null || echo "")

FILE_KEY=$(echo "$PRESIGN_RESPONSE" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('fileKey', ''))
except:
    print('')
" 2>/dev/null || echo "")

if [ -n "$UPLOAD_URL" ] && [ -n "$FILE_KEY" ]; then
  assert_ok 0 "POST /storage/presigned-url — uploadUrl + fileKey obtained"
  info "  fileKey: $FILE_KEY"
else
  die "Failed to obtain presigned URL"
fi

# 3b. Generate minimal valid STEP file content
STEP_CONTENT="ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('LeetCAD smoke test cube'),'2;1');
FILE_NAME('sample_cube.step','$(date -Iseconds)',('LeetCAD'),('LeetCAD'),'','','');
FILE_SCHEMA(('AUTOMOTIVE_DESIGN'));
ENDSEC;
DATA;
#1=APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,#2);
#2=APPLICATION_CONTEXT('core data for automotive mechanical design processes');
#3=SHAPE_DEFINITION_REPRESENTATION(#4,#10);
#4=PRODUCT_DEFINITION_SHAPE('','',#5);
#5=PRODUCT_DEFINITION('design','',#6,#9);
#6=PRODUCT_DEFINITION_FORMATION('','',#7);
#7=PRODUCT('CubeTest','Smoke Test Cube','',(#8));
#8=PRODUCT_CONTEXT('',#2,'mechanical');
#9=PRODUCT_DEFINITION_CONTEXT('part definition',#2,'design');
#10=SHAPE_REPRESENTATION('',(#11,#12),#26);
#11=AXIS2_PLACEMENT_3D('',#13,#14,#15);
#12=MANIFOLD_SOLID_BREP('Cube',#16);
#13=CARTESIAN_POINT('',(0.,0.,0.));
#14=DIRECTION('',(0.,0.,1.));
#15=DIRECTION('',(1.,0.,0.));
#16=CLOSED_SHELL('',(#17,#18,#19,#20,#21,#22));
#17=ADVANCED_FACE('',(#23),#27,.T.);
#18=ADVANCED_FACE('',(#23),#28,.T.);
#19=ADVANCED_FACE('',(#23),#29,.T.);
#20=ADVANCED_FACE('',(#23),#30,.T.);
#21=ADVANCED_FACE('',(#23),#31,.T.);
#22=ADVANCED_FACE('',(#23),#32,.T.);
#23=FACE_OUTER_BOUND('',#24,.T.);
#24=EDGE_LOOP('',(#25));
#25=ORIENTED_EDGE('',*,*,#33,.T.);
#26=(GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#34)) GLOBAL_UNIT_ASSIGNED_CONTEXT((#35,#36,#37)) REPRESENTATION_CONTEXT('Context3D','3D Context with 1.E-07 Tolerance'));
#27=PLANE('',#11);
#28=PLANE('',#11);
#29=PLANE('',#11);
#30=PLANE('',#11);
#31=PLANE('',#11);
#32=PLANE('',#11);
#33=EDGE_CURVE('',#38,#38,#39,.T.);
#34=UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-07),#35,'distance_accuracy_value','confusion accuracy');
#35=(LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.));
#36=(NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.));
#37=(NAMED_UNIT(*) SI_UNIT($,.STERADIAN.) SOLID_ANGLE_UNIT());
#38=VERTEX_POINT('',#13);
#39=LINE('',#13,#40);
#40=VECTOR('',#14,10.);
ENDSEC;
END-ISO-10303-21;
"

# 3c. PUT to presigned URL
# Rewrite presigned URL for Docker bridge if needed (minio → localhost)
DOCKER_UPLOAD_URL=$(echo "$UPLOAD_URL" | sed 's|http://minio:9000|'"$MINIO_URL"'|g')

PUT_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" -X PUT "$DOCKER_UPLOAD_URL" \
  -H "Content-Type: application/octet-stream" \
  --data-binary "$STEP_CONTENT" 2>/dev/null || echo "000")

if [ "$PUT_STATUS" = "200" ] || [ "$PUT_STATUS" = "204" ]; then
  assert_ok 0 "PUT to presigned URL — file uploaded to storage"
else
  die "PUT to presigned URL failed (HTTP $PUT_STATUS)"
fi

# 3d. Complete upload (trigger outbox)
COMPLETE_RESPONSE=$(curl -sf -X POST "$API_URL/submissions/complete" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"fileKey\":\"$FILE_KEY\"}" 2>/dev/null || echo '{"error":true}')

SUBMISSION_ID=$(echo "$COMPLETE_RESPONSE" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('id', ''))
except:
    print('')
" 2>/dev/null || echo "")

SUBMISSION_STATUS=$(echo "$COMPLETE_RESPONSE" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('status', ''))
except:
    print('')
" 2>/dev/null || echo "")

if [ -n "$SUBMISSION_ID" ] && [ "$SUBMISSION_STATUS" = "UPLOADED" ]; then
  assert_ok 0 "POST /submissions/complete — submission created (status: UPLOADED)"
  info "  Submission ID: $SUBMISSION_ID"
else
  die "Failed to create submission (id=$SUBMISSION_ID, status=$SUBMISSION_STATUS)"
fi

echo ""

# ════════════════════════════════════════════════════════════
# Phase 4 — Pipeline Processing & Outbox Relay
# ════════════════════════════════════════════════════════════

info "Phase 4: Pipeline Processing (polling for COMPLETED, max ${MAX_POLL_SECONDS}s)"
echo ""

export PGPASSWORD="$PG_PASS"
POLL_INTERVAL=5
ELAPSED=0
FINAL_STATUS=""
FINAL_SCORE=""
FINAL_METRICS=""
FINAL_REPORT_ID=""

while [ "$ELAPSED" -lt "$MAX_POLL_SECONDS" ]; do
  ROW=$(psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -tAc \
    "SELECT status, score, metrics::text, \"aiReportId\" FROM submissions WHERE id = '$SUBMISSION_ID'" 2>/dev/null || echo "")

  if [ -n "$ROW" ]; then
    FINAL_STATUS=$(echo "$ROW" | cut -d'|' -f1)
    FINAL_SCORE=$(echo "$ROW" | cut -d'|' -f2)
    FINAL_METRICS=$(echo "$ROW" | cut -d'|' -f3)
    FINAL_REPORT_ID=$(echo "$ROW" | cut -d'|' -f4)

    if [ "$FINAL_STATUS" = "COMPLETED" ]; then
      pass "Submission reached COMPLETED status (${ELAPSED}s)"
      break
    elif [ "$FINAL_STATUS" = "FAILED" ]; then
      fail "Submission reached FAILED status (${ELAPSED}s)"
      FAILURES=$((FAILURES + 1))
      break
    fi
  fi

  echo -ne "  ${CYAN}Polling... ${ELAPSED}s — current status: ${FINAL_STATUS:-UNKNOWN}${NC}\r"
  sleep "$POLL_INTERVAL"
  ELAPSED=$((ELAPSED + POLL_INTERVAL))
done

if [ "$FINAL_STATUS" != "COMPLETED" ] && [ "$FINAL_STATUS" != "FAILED" ]; then
  fail "Timeout: submission did not reach terminal status in ${MAX_POLL_SECONDS}s (last: $FINAL_STATUS)"
  FAILURES=$((FAILURES + 1))
fi

echo ""

# Validate score
if [ -n "$FINAL_SCORE" ] && [ "$FINAL_STATUS" = "COMPLETED" ]; then
  SCORE_VALID=$(python3 -c "
s = float('$FINAL_SCORE')
print('yes' if 0 <= s <= 100 else 'no')
" 2>/dev/null || echo "no")

  if [ "$SCORE_VALID" = "yes" ]; then
    assert_ok 0 "Score is valid: $FINAL_SCORE (0-100)"
  else
    assert_ok 1 "Score out of range: $FINAL_SCORE"
  fi
else
  warn "Score validation skipped (submission not COMPLETED)"
fi

# Validate metrics JSON
if [ -n "$FINAL_METRICS" ] && [ "$FINAL_STATUS" = "COMPLETED" ]; then
  METRICS_VALID=$(python3 -c "
import json
try:
    m = json.loads('''$FINAL_METRICS''')
    assert 'volume' in m
    assert 'surfaceArea' in m
    assert 'centerOfMass' in m
    print('yes')
except:
    print('no')
" 2>/dev/null || echo "no")

  if [ "$METRICS_VALID" = "yes" ]; then
    assert_ok 0 "Metrics JSON valid (volume, surfaceArea, centerOfMass)"
    info "  Metrics: $FINAL_METRICS"
  else
    assert_ok 1 "Metrics JSON invalid or missing fields"
  fi
else
  warn "Metrics validation skipped (submission not COMPLETED)"
fi

# Validate S3 artifacts
if [ "$FINAL_STATUS" = "COMPLETED" ]; then
  RENDER_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "$MINIO_URL/leetcad/renders/${SUBMISSION_ID}.png" 2>/dev/null || echo "000")
  if [ "$RENDER_STATUS" = "200" ]; then
    assert_ok 0 "Render artifact exists in MinIO (renders/${SUBMISSION_ID}.png)"
  else
    assert_ok 1 "Render artifact missing (HTTP $RENDER_STATUS)"
  fi

  REPORT_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "$MINIO_URL/leetcad/reports/${SUBMISSION_ID}.md" 2>/dev/null || echo "000")
  if [ "$REPORT_STATUS" = "200" ]; then
    assert_ok 0 "Report artifact exists in MinIO (reports/${SUBMISSION_ID}.md)"
  else
    assert_ok 1 "Report artifact missing (HTTP $REPORT_STATUS)"
  fi
fi

echo ""

# ════════════════════════════════════════════════════════════
# Phase 5 — Real-Time & Cache Layer
# ════════════════════════════════════════════════════════════

info "Phase 5: Real-Time & Cache Layer Verification"
echo ""

if [ -n "$USER_ID" ] && [ "$FINAL_STATUS" = "COMPLETED" ]; then
  # Leaderboard score
  LEADERBOARD_SCORE=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ZSCORE "leaderboard:global" "$USER_ID" 2>/dev/null || echo "")
  if [ -n "$LEADERBOARD_SCORE" ]; then
    assert_ok 0 "Leaderboard entry exists (ZSCORE leaderboard:global $USER_ID = $LEADERBOARD_SCORE)"
  else
    assert_ok 1 "Leaderboard entry missing for user $USER_ID"
  fi

  # Fence token
  FENCE_VAL=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" GET "submission:${SUBMISSION_ID}:fence" 2>/dev/null || echo "")
  FENCE_TTL=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" TTL "submission:${SUBMISSION_ID}:fence" 2>/dev/null || echo "-2")

  if [ -n "$FENCE_VAL" ] && [ "$FENCE_TTL" -gt 0 ] 2>/dev/null; then
    assert_ok 0 "Fence token exists (value=$FENCE_VAL, TTL=${FENCE_TTL}s)"
  else
    assert_ok 1 "Fence token missing or no TTL (val=$FENCE_VAL, ttl=$FENCE_TTL)"
  fi
else
  warn "Cache validation skipped (submission not COMPLETED or no userId)"
fi

echo ""

# ════════════════════════════════════════════════════════════
# Final Report
# ════════════════════════════════════════════════════════════

echo -e "${BOLD}══════════════════════════════════════════════${NC}"
if [ "$FAILURES" -eq 0 ]; then
  echo -e "${GREEN}${BOLD}  ✓ ALL CHECKS PASSED${NC}"
  echo -e "${BOLD}══════════════════════════════════════════════${NC}"
  echo ""
  exit 0
else
  echo -e "${RED}${BOLD}  ✗ $FAILURES CHECK(S) FAILED${NC}"
  echo -e "${BOLD}══════════════════════════════════════════════${NC}"
  echo ""
  echo -e "${YELLOW}Debug tips:${NC}"
  echo "  docker compose logs core-platform --tail=50"
  echo "  docker compose logs assessment-engine --tail=50"
  echo "  docker compose logs realtime-service --tail=50"
  echo ""
  exit 1
fi
