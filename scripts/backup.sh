#!/usr/bin/env bash
# STALE -- written for the pre-Coolify bare-metal deployment (container name
# "fenris_db", host path /var/www/sites/projectfenris-site, bare Nginx config
# at /etc/nginx/sites-available/...). None of that exists anymore post-Coolify
# migration (2026-05-28/30), so as-is this script cannot run successfully.
# Local pg_dump backups now run via the `backup` service in docker-compose.yml
# (see backup/backup.sh) instead. This file is kept only for its rclone/B2
# upload logic, as a starting point for wiring that same off-site upload step
# into the compose-native backup service -- do not cron this file as-is.
#
# Original header, for reference:
# Fenris backup -- postgres dump, user uploads, .env, nginx config.
# Requires: rclone configured with b2-fenris remote.
#
# Cron (daily at 2am):
#   0 2 * * * DB_NAME=fenris DB_USER=fenris /path/to/scripts/backup.sh >> /var/log/fenris-backup.log 2>&1

set -euo pipefail

CONTAINER="fenris_db"
DB_NAME="${DB_NAME:-fenris}"
DB_USER="${DB_USER:-fenris}"
RCLONE_REMOTE="b2-fenris:nexus-restic/fenris-backups"
KEEP_DAYS=30
BACKUP_DIR="/tmp/fenris-backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
PROJECT_DIR="/var/www/sites/projectfenris-site"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] === Fenris backup $TIMESTAMP ==="

# 1. Postgres
DB_FILE="$BACKUP_DIR/db_${TIMESTAMP}.sql.gz"
echo "[$(date)] Dumping database..."
docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$DB_FILE"
echo "[$(date)] DB dump complete ($(du -sh "$DB_FILE" | cut -f1))"

# 2. User avatar uploads
UPLOADS_FILE="$BACKUP_DIR/uploads_${TIMESTAMP}.tar.gz"
echo "[$(date)] Backing up uploads volume..."
docker exec fenris_api tar cf - /app/uploads 2>/dev/null | gzip > "$UPLOADS_FILE"
echo "[$(date)] Uploads complete ($(du -sh "$UPLOADS_FILE" | cut -f1))"

# 3. .env file
ENV_FILE="$BACKUP_DIR/env_${TIMESTAMP}.tar.gz"
echo "[$(date)] Backing up .env..."
tar czf "$ENV_FILE" -C "$PROJECT_DIR" .env
echo "[$(date)] .env complete"

# 4. nginx site config (includes certbot SSL directives)
NGINX_FILE="$BACKUP_DIR/nginx_${TIMESTAMP}.tar.gz"
echo "[$(date)] Backing up nginx config..."
tar czf "$NGINX_FILE" /etc/nginx/sites-available/projectfenris.com 2>/dev/null || true
echo "[$(date)] nginx config complete"

# Upload all
echo "[$(date)] Uploading to B2..."
rclone copy "$BACKUP_DIR" "$RCLONE_REMOTE" --include "*_${TIMESTAMP}.*"
echo "[$(date)] Upload complete"

# Cleanup local temp files
rm -f "$DB_FILE" "$UPLOADS_FILE" "$ENV_FILE" "$NGINX_FILE"

# Prune old backups
echo "[$(date)] Pruning backups older than ${KEEP_DAYS} days..."
rclone delete "$RCLONE_REMOTE" --min-age "${KEEP_DAYS}d" \
  --include "db_*.sql.gz" \
  --include "uploads_*.tar.gz" \
  --include "env_*.tar.gz" \
  --include "nginx_*.tar.gz"

echo "[$(date)] Backup done."
