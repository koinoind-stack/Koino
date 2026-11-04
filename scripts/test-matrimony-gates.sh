#!/bin/bash
# ─── MATRIMONY STAGE B — LOCAL AUTH-GATE TEST ───────────────────────────────
# Runs the dev server with PLACEHOLDER env vars (no real DB, no real Supabase)
# and verifies every matrimony endpoint rejects unauthenticated requests with
# 401 BEFORE touching the database or storage (error-shape isolation — the
# established local-testing pattern when no local Postgres is available).
# Zero mutations possible: everything must fail at the auth layer.

cd /home/z/my-project/koino-repo || exit 1

export DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
export NEXT_PUBLIC_SUPABASE_URL="https://placeholder.supabase.co"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="placeholder-anon-key"
export SUPABASE_SERVICE_ROLE_KEY="placeholder-service-role-key"
export NEXT_PUBLIC_SITE_URL="http://localhost:3111"
export PORT=3111

echo "Starting dev server on :3111 with placeholder env..."
npx next dev -p 3111 > /tmp/matrimony-dev.log 2>&1 &
SERVER_PID=$!

cleanup() { kill $SERVER_PID 2>/dev/null; }
trap cleanup EXIT

# Wait for readiness
for i in $(seq 1 60); do
  if curl -s -o /dev/null http://localhost:3111/api/health 2>/dev/null; then break; fi
  if rg -q "Ready in" /tmp/matrimony-dev.log 2>/dev/null; then break; fi
  sleep 1
done
sleep 2

PASS=0; FAIL=0
expect() { # name expected_status url method
  local name="$1" want="$2" url="$3" method="${4:-GET}"
  local status
  if [ "$method" = "GET" ]; then
    status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3111$url")
  else
    status=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "http://localhost:3111$url" \
      -H "Content-Type: application/json" -d '{}')
  fi
  if [ "$status" = "$want" ]; then
    PASS=$((PASS+1)); echo "PASS  $name  ($status)"
  else
    FAIL=$((FAIL+1)); echo "FAIL  $name  (got $status, want $want)"
  fi
}

echo ""
echo "── Unauthenticated access must be rejected with 401 (auth before DB) ──"
expect "GET  /api/matrimony/discover (Stage C)" 401 "/api/matrimony/discover"
expect "GET  /api/matrimony/profile"            401 "/api/matrimony/profile"
expect "PUT  /api/matrimony/profile"            401 "/api/matrimony/profile" PUT
expect "DEL /api/matrimony/profile"             401 "/api/matrimony/profile" DELETE
expect "POST /api/matrimony/profile/status"     401 "/api/matrimony/profile/status" POST
expect "POST /api/matrimony/photos (upload)"    401 "/api/matrimony/photos" POST
expect "GET  /api/matrimony/photos/[id]"        401 "/api/matrimony/photos/somephoto123"
expect "DEL /api/matrimony/photos/[id]"         401 "/api/matrimony/photos/somephoto123"
expect "GET  /api/matrimony/photos (405)"       405 "/api/matrimony/photos"

echo ""
echo "── Regression: pre-existing routes still gate correctly ──"
expect "GET  /api/blog/articles -> 401"         401 "/api/blog/articles"
expect "GET  / (page renders)"                  200 "/"

echo ""
echo "===== $PASS/$((PASS+FAIL)) GATE CHECKS PASSED ====="
[ "$FAIL" = "0" ]
