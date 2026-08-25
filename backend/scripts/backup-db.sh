#!/usr/bin/env bash
# ursGAL DB-ийн өдөр тутмын backup.
# Хэрэглээ:  bash scripts/backup-db.sh
# DATABASE_URL-ыг backend/.env-ээс уншина; BACKUP_DIR-ээр хавтсыг өөрчилж болно.
#
# Cron жишээ (өдөр бүр 03:00-д, 2 долоо хоног хадгална):
#   crontab -e  дээр нэмэх:
#   0 3 * * * bash /home/kali/ursGAL/backend/scripts/backup-db.sh >> /home/kali/ursgal-backups/backup.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# .env-ээс DATABASE_URL унших
set -a
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../.env"
set +a

BACKUP_DIR="${BACKUP_DIR:-$HOME/ursgal-backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
mkdir -p "$BACKUP_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$BACKUP_DIR/ursgal-$STAMP.sql.gz"

# Prisma-гийн ?schema=... query-г pg_dump ойлгодоггүй тул хасна
PG_URL="${DATABASE_URL%%\?*}"

pg_dump "$PG_URL" | gzip > "$FILE"

# Хуучин backup-уудыг цэвэрлэх
find "$BACKUP_DIR" -name 'ursgal-*.sql.gz' -mtime "+$KEEP_DAYS" -delete

echo "OK: $FILE ($(du -h "$FILE" | cut -f1))"

# Сэргээх заавар:
#   gunzip -c ursgal-YYYYMMDD-HHMMSS.sql.gz | psql "$DATABASE_URL"
