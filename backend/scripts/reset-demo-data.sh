#!/usr/bin/env bash
# Демо өгөгдлийг цэвэрлэнэ — дэлгэрэнгүйг reset-demo-data.sql-ээс үзнэ үү.
#
# ⚠ ЭРГЭШГҮЙ ҮЙЛДЭЛ.
# Хамгаалалт: (1) юу устахыг харуулна, (2) гараар баталгаажуулахыг
# шаардана, (3) өөрөө нөөцлөлт авна. Гурвуулаа давсны дараа л ажиллана.
#
# Хэрэглээ:  bash scripts/reset-demo-data.sh

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

set -a
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../.env"
set +a

echo "═══ УСТАХ ═══"
psql "$DATABASE_URL" -tAc "
SELECT '  захиалга: '||(SELECT count(*) FROM \"Order\")
  ||E'\n  санхүүгийн бичилт: '||(SELECT count(*) FROM \"FinanceEntry\")
  ||E'\n  агуулахын хөдөлгөөн: '||(SELECT count(*) FROM \"StockMovement\")
  ||E'\n  бараа: '||(SELECT count(*) FROM \"Product\" WHERE sku <> 'UG-32323232')
  ||E'\n  мэдэгдэл: '||(SELECT count(*) FROM \"Notification\")
  ||E'\n  үйлдлийн түүх: '||(SELECT count(*) FROM \"ActivityLog\");"

echo
echo "═══ ҮЛДЭХ ═══"
psql "$DATABASE_URL" -tAc "
SELECT '  хэрэглэгч: '||(SELECT count(*) FROM \"User\")
  ||E'\n  эрхийн тохиргоо: '||(SELECT count(*) FROM \"UserPermission\")
  ||E'\n  системийн тохиргоо: '||(SELECT count(*) FROM \"Setting\")
  ||E'\n  жолоочийн профайл ба бүс: '||(SELECT count(*) FROM \"DriverProfile\")
  ||E'\n  moringa 210g (үлдэгдэл 0 болно)';"

echo
read -r -p 'Үргэлжлүүлэхийн тулд ЦЭВЭРЛЭ гэж бичнэ үү: ' answer
if [ "$answer" != "ЦЭВЭРЛЭ" ]; then
  echo "Цуцлагдлаа — юу ч өөрчлөгдөөгүй."
  exit 1
fi

echo
echo "Нөөцлөж байна…"
bash "$SCRIPT_DIR/backup-db.sh"

echo
echo "Цэвэрлэж байна…"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/reset-demo-data.sql"

echo
echo "✓ Дууслаа."
echo
echo "Дараагийн алхам:"
echo "  1. Бодит бүтээгдэхүүнээ ӨРТӨГТЭЙ нь оруулах (Бараа → CSV импорт)"
echo "     Багана: SKU,Нэр,Ангилал,Үнэ,Өртөг,Barcode,Доод хязгаар,Эхний үлдэгдэл"
echo "  2. Тохиргоо → банкны данс, компанийн утсаа бөглөх"
echo "  3. Excel дээрх зардлаа Санхүү → «+ Гүйлгээ нэмэх»-ээр оруулах"
