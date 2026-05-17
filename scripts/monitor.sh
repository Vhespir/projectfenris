#!/usr/bin/env bash
# Fenris uptime monitor -- curls /api/health every run, emails via Resend after 3 consecutive failures.
#
# Requires: RESEND_API_KEY and ALERT_EMAIL set in environment or /etc/fenris-monitor.env
# Cron (every 5 minutes):
#   */5 * * * * /path/to/projectfenris-site/scripts/monitor.sh

set -euo pipefail

HEALTH_URL="${HEALTH_URL:-https://projectfenris.com/api/health}"
FAIL_THRESHOLD=3
STATE_FILE="/tmp/fenris-monitor-failures"
ENV_FILE="/etc/fenris-monitor.env"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

: "${RESEND_API_KEY:?RESEND_API_KEY is required}"
: "${ALERT_EMAIL:?ALERT_EMAIL is required}"

current_failures=0
if [[ -f "$STATE_FILE" ]]; then
  current_failures=$(cat "$STATE_FILE")
fi

if curl --silent --fail --max-time 10 "$HEALTH_URL" > /dev/null 2>&1; then
  if [[ "$current_failures" -ge "$FAIL_THRESHOLD" ]]; then
    echo "[$(date)] Site recovered after $current_failures failures -- sending recovery email"
    curl --silent --request POST \
      --url https://api.resend.com/emails \
      --header "Authorization: Bearer $RESEND_API_KEY" \
      --header "Content-Type: application/json" \
      --data "{
        \"from\": \"Project Fenris Monitor <monitor@projectfenris.com>\",
        \"to\": [\"$ALERT_EMAIL\"],
        \"subject\": \"[RECOVERED] Project Fenris is back up\",
        \"html\": \"<p>Project Fenris is responding normally at <a href='$HEALTH_URL'>$HEALTH_URL</a>.</p><p>Was down for approximately $((current_failures * 5)) minutes.</p>\"
      }"
  fi
  echo 0 > "$STATE_FILE"
  exit 0
fi

new_failures=$((current_failures + 1))
echo "$new_failures" > "$STATE_FILE"
echo "[$(date)] Health check failed ($new_failures/$FAIL_THRESHOLD)"

if [[ "$new_failures" -eq "$FAIL_THRESHOLD" ]]; then
  echo "[$(date)] Threshold reached -- sending alert email"
  curl --silent --request POST \
    --url https://api.resend.com/emails \
    --header "Authorization: Bearer $RESEND_API_KEY" \
    --header "Content-Type: application/json" \
    --data "{
      \"from\": \"Project Fenris Monitor <monitor@projectfenris.com>\",
      \"to\": [\"$ALERT_EMAIL\"],
      \"subject\": \"[DOWN] Project Fenris is not responding\",
      \"html\": \"<p><strong>Project Fenris is down.</strong></p><p>Health check at <a href='$HEALTH_URL'>$HEALTH_URL</a> has failed $FAIL_THRESHOLD times in a row.</p><p>Check the server: <code>docker compose ps</code> and <code>docker compose logs --tail=50</code></p>\"
    }"
fi
