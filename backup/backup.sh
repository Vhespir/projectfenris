#!/usr/bin/env bash
# Fenris local backup loop -- dumps Postgres on an interval, prunes old dumps.
#
# This is deliberately the same "just loop and sleep" style as worker/index.js's
# node-cron usage: simple, no cron daemon to configure, easy to reason about.
#
# Local-disk only. This protects against a bad deploy / accidental volume reset
# (the incident that prompted this) but NOT against losing the whole VPS. Off-site
# copies (e.g. to Backblaze B2) are a separate, later step once B2 credentials
# are wired in via Coolify's Environment Variables.

set -euo pipefail

DB_HOST="${DB_HOST:-db}"
RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-14}"
INTERVAL_SECONDS="${BACKUP_INTERVAL_SECONDS:-86400}"  # daily by default
BACKUP_DIR="/backups"

echo "[backup] starting -- dumping every ${INTERVAL_SECONDS}s, keeping ${RETAIN_DAYS} days, writing to ${BACKUP_DIR}"

while true; do
  STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
  FILE="${BACKUP_DIR}/fenris_${STAMP}.sql.gz"

  echo "[backup] $(date -u) dumping to ${FILE}"
  if PGPASSWORD="${DB_PASSWORD}" pg_dump -h "${DB_HOST}" -U "${DB_USER}" -d "${DB_NAME}" | gzip > "${FILE}.tmp"; then
    mv "${FILE}.tmp" "${FILE}"
    echo "[backup] $(date -u) done ($(du -h "${FILE}" | cut -f1))"
  else
    echo "[backup] $(date -u) pg_dump FAILED -- leaving previous backups untouched"
    rm -f "${FILE}.tmp"
  fi

  echo "[backup] pruning dumps older than ${RETAIN_DAYS} days"
  find "${BACKUP_DIR}" -name 'fenris_*.sql.gz' -mtime "+${RETAIN_DAYS}" -delete

  sleep "${INTERVAL_SECONDS}"
done
