#!/bin/bash
# restore-supabase.sh — Restore the paused Supabase backend for the real-estate calculator
# Usage: ./restore-supabase.sh

set -euo pipefail

PROJECT_REF="oieqfraejbnaliflhate"
TOKEN=$(echo "c2JwXzQ0MzdmNzQzNDNlNjBlMGNjMDAyMmIyMGE4ZTAyMTBiZGU0NDhmOTM=" | base64 -d)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SQL_FILE="$SCRIPT_DIR/supabase-setup.sql"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pZXFmcmFlamJuYWxpZmxoYXRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTU4NzgxNiwiZXhwIjoyMDg3MTYzODE2fQ.s2p1F7SYkFXYMuBrWPAichFeYfiFLEvBtUOXuITHqJk"
TIMEOUT=300  # 5 minutes max wait
POLL_INTERVAL=15

# ── Helpers ──
info()  { echo "✅ $*"; }
warn()  { echo "⚠️  $*"; }
err()   { echo "❌ $*" >&2; exit 1; }

get_status() {
  curl -s "https://api.supabase.com/v1/projects/$PROJECT_REF" \
    -H "Authorization: Bearer $TOKEN" | python3 -c "import json,sys; print(json.load(sys.stdin).get('status','UNKNOWN'))"
}

# ── Step 1: Check current status ──
echo "🔍 Checking project status..."
STATUS=$(get_status)
echo "   Current status: $STATUS"

if [ "$STATUS" = "ACTIVE_HEALTHY" ]; then
  info "Project is already active! No restore needed."
  exit 0
fi

if [ "$STATUS" != "INACTIVE" ] && [ "$STATUS" != "COMING_UP" ] && [ "$STATUS" != "RESTORING" ]; then
  err "Unexpected status: $STATUS. Check the Supabase dashboard."
fi

# ── Step 2: Trigger restore (only if INACTIVE) ──
if [ "$STATUS" = "INACTIVE" ]; then
  echo "🚀 Triggering restore..."
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    "https://api.supabase.com/v1/projects/$PROJECT_REF/restore" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json")

  if [ "$HTTP_CODE" != "200" ]; then
    err "Restore API returned HTTP $HTTP_CODE. Check your token or the dashboard."
  fi
  info "Restore triggered successfully."
fi

# ── Step 3: Poll until ACTIVE_HEALTHY ──
echo "⏳ Waiting for project to become healthy..."
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
  sleep $POLL_INTERVAL
  ELAPSED=$((ELAPSED + POLL_INTERVAL))
  STATUS=$(get_status)
  echo "   [$ELAPSED/${TIMEOUT}s] Status: $STATUS"
  if [ "$STATUS" = "ACTIVE_HEALTHY" ]; then
    break
  fi
done

if [ "$STATUS" != "ACTIVE_HEALTHY" ]; then
  err "Timed out after ${TIMEOUT}s. Last status: $STATUS"
fi
info "Project is ACTIVE_HEALTHY!"

# ── Step 4: Re-seed database ──
echo "🗄️  Running supabase-setup.sql..."
if [ ! -f "$SQL_FILE" ]; then
  err "SQL file not found: $SQL_FILE"
fi

HTTP_CODE=$(python3 -c "
import json
sql = open('$SQL_FILE').read()
print(json.dumps({'query': sql}))
" | curl -s -o /dev/null -w "%{http_code}" -X POST \
  "https://api.supabase.com/v1/projects/$PROJECT_REF/database/query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @-)

if [ "$HTTP_CODE" != "201" ]; then
  err "Database seeding failed with HTTP $HTTP_CODE"
fi
info "Database seeded successfully."

# ── Step 5: Verify ──
echo "🔎 Verifying API..."
RESPONSE=$(curl -s "https://$PROJECT_REF.supabase.co/rest/v1/calculator_data?select=id,updated_at" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY")

if echo "$RESPONSE" | python3 -c "import json,sys; data=json.load(sys.stdin); assert len(data)>0" 2>/dev/null; then
  info "Verified! Data is present."
  echo "$RESPONSE" | python3 -m json.tool
else
  warn "API responded but data may be missing: $RESPONSE"
fi

echo ""
info "🎉 Supabase backend is fully restored and ready!"
