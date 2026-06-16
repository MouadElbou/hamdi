#!/usr/bin/env bash
#
# pg-backup.sh — timestamped, compressed PostgreSQL backups with retention pruning.
#
# Produces custom-format dumps (pg_dump -Fc) which restore with pg_restore and
# support selective/parallel restore. Idempotent and safe to run from cron.
#
# Connection is read from the environment (12-factor). Either set DATABASE_URL,
# or set the individual PG* variables below. DATABASE_URL takes precedence.
#
# Environment:
#   DATABASE_URL    postgresql://user:pass@host:5432/dbname   (preferred)
#   --- or ---
#   PGHOST          (default: localhost)
#   PGPORT          (default: 5432)
#   PGUSER          (default: postgres)
#   PGPASSWORD      (no default — required if the server needs a password)
#   PGDATABASE      (default: stock_platform)
#
#   BACKUP_DIR      target directory for dumps   (default: ./backups)
#   RETENTION_DAYS  prune dumps older than N days (default: 14)
#
# Example (cron, daily at 02:30):
#   30 2 * * *  DATABASE_URL=postgresql://... BACKUP_DIR=/var/backups/stock \
#               /opt/stock/scripts/pg-backup.sh >> /var/log/stock-backup.log 2>&1
#
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

# Resolve a human-readable DB name for the filename and a connection target for pg_dump.
if [ -n "${DATABASE_URL:-}" ]; then
  # Derive the database name from the URL path for the filename (strip query string).
  DB_NAME="$(printf '%s' "$DATABASE_URL" | sed -E 's#.*/([^/?]+)(\?.*)?$#\1#')"
  CONN=("$DATABASE_URL")
else
  DB_NAME="${PGDATABASE:-stock_platform}"
  CONN=(
    --host="${PGHOST:-localhost}"
    --port="${PGPORT:-5432}"
    --username="${PGUSER:-postgres}"
    --dbname="$DB_NAME"
  )
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
OUTFILE="${BACKUP_DIR%/}/${DB_NAME}-${TIMESTAMP}.dump"
TMPFILE="${OUTFILE}.partial"

echo "[pg-backup] dumping '${DB_NAME}' -> ${OUTFILE}"

# -Fc = custom (compressed) format. Write to a .partial first, then atomically
# rename, so an interrupted run never leaves a half-written file that looks valid.
pg_dump -Fc --no-owner --no-privileges --file="$TMPFILE" "${CONN[@]}"
mv -f "$TMPFILE" "$OUTFILE"

echo "[pg-backup] wrote $(du -h "$OUTFILE" | cut -f1) to ${OUTFILE}"

# Prune dumps older than RETENTION_DAYS (only this script's own .dump files).
echo "[pg-backup] pruning dumps older than ${RETENTION_DAYS} day(s) in ${BACKUP_DIR}"
find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.dump' -mtime "+${RETENTION_DAYS}" -print -delete || true

echo "[pg-backup] done"
