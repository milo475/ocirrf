#!/usr/bin/env bash
# ursGAL-ийн өдөр тутмын backup: DB dump + uploads/ (баталгаажуулах зургууд).
# Хэрэглээ:  bash scripts/backup-db.sh
# DATABASE_URL, UPLOADS_DIR-ыг backend/.env-ээс уншина; BACKUP_DIR-ээр хавтсыг өөрчилж болно.
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

# Хүргэлтийн баталгаажуулах зургууд (uploads/) — DB-д зөвхөн зам нь
# хадгалагддаг тул файлуудыг нь заавал хамт хадгална
UPLOADS_SRC="${UPLOADS_DIR:-$SCRIPT_DIR/../uploads}"
UPLOADS_FILE="$BACKUP_DIR/ursgal-uploads-$STAMP.tar.gz"
if [ -d "$UPLOADS_SRC" ]; then
  tar -czf "$UPLOADS_FILE" -C "$(dirname "$UPLOADS_SRC")" "$(basename "$UPLOADS_SRC")"
else
  echo "Анхаар: uploads хавтас олдсонгүй ($UPLOADS_SRC)"
fi

# Хуучин backup-уудыг цэвэрлэх
find "$BACKUP_DIR" -name 'ursgal-*.sql.gz' -mtime "+$KEEP_DAYS" -delete
find "$BACKUP_DIR" -name 'ursgal-uploads-*.tar.gz' -mtime "+$KEEP_DAYS" -delete

echo "OK: $FILE ($(du -h "$FILE" | cut -f1))"
[ -f "$UPLOADS_FILE" ] && echo "OK: $UPLOADS_FILE ($(du -h "$UPLOADS_FILE" | cut -f1))"

# Сэргээх заавар:
#   DB:      gunzip -c ursgal-YYYYMMDD-HHMMSS.sql.gz | psql "$DATABASE_URL"
#   Зургууд: tar -xzf ursgal-uploads-YYYYMMDD-HHMMSS.tar.gz -C /зорьсон/зам/
