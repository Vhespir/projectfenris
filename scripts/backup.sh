#!/usr/bin/env bash
# Fenris DB backup -- dumps postgres, compresses, uploads to Backblaze B2, prunes old backups.
# Requires: rclone configured with a remote named "b2" pointing to your B2 bucket.
#
# Setup:
#   sudo apt install rclone
#   rclone config  (create a remote named "b2", type "b2", enter keyID + applicationKey)
#
# Cron (daily at 2am):
#   0 2 * * * /path/to/projectfenris-site/scripts/backup.sh >> /var/log/fenris-backup.log 2>&1

set -euo pipefail

CONTAINER="fenris_db"
DB_NAME="${DB_NAME:-fenris}"
DB_USER="${DB_USER:-fenris}"
RCLONE_REMOTE="b2:fenris-backups"
KEEP_DAYS=30
BACKUP_DIR="/tmp/fenris-backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
FILENAME="fenris_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup: $FILENAME"

docker exec "$CONTAINER" \
  pg_dump -U "$DB_USER" "$DB_NAME" \
  | gzip > "$BACKUP_DIR/$FILENAME"

echo "[$(date)] Dump complete ($(du -sh "$BACKUP_DIR/$FILENAME" | cut -f1)), uploading..."

rclone copy "$BACKUP_DIR/$FILENAME" "$RCLONE_REMOTE"

rm "$BACKUP_DIR/$FILENAME"

echo "[$(date)] Upload complete. Pruning backups older than ${KEEP_DAYS} days..."

rclone delete "$RCLONE_REMOTE" \
  --min-age "${KEEP_DAYS}d" \
  --include "fenris_*.sql.gz"

echo "[$(date)] Backup done."
