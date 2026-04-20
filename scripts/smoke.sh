#!/usr/bin/env bash
set -euo pipefail
: "${SUPERVISOR_PASSWORD:?set SUPERVISOR_PASSWORD}"
: "${PULSE_INGEST_TOKEN:?set PULSE_INGEST_TOKEN}"

docker compose up -d --build
sleep 5
docker compose exec -T web pnpm seed

node scripts/simulate-pulses.js --base http://localhost:3000 --token "$PULSE_INGEST_TOKEN" --password "$SUPERVISOR_PASSWORD" --duration 30 &
SIM_PID=$!
sleep 35
kill $SIM_PID 2>/dev/null || true

COOKIE=$(curl -s -c - -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"password\":\"$SUPERVISOR_PASSWORD\"}" | grep mes_session | awk '{print $7}')

RESP=$(curl -s -H "Cookie: mes_session=$COOKIE" http://localhost:3000/api/dashboard)
echo "$RESP" | jq -e '.workcenters | length == 4' > /dev/null
echo "$RESP" | jq -e '.totals.shiftQty > 0'      > /dev/null
echo "$RESP" | jq -e '.workcenters[0].hourly | length == 4' > /dev/null

echo "smoke OK"
docker compose down
