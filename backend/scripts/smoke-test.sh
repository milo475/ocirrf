#!/usr/bin/env bash
# ursGAL — амьд сервер дээрх суурь шалгалт.
#
# Гүнзгий шалгалтыг e2e хийдэг (test/api-v2.e2e-spec.ts, 170+ тест).
# Энэ скрипт нь ӨӨР зүйл шалгана: барьсан контейнер/сервер ажиллаж,
# нэвтрэлт болон эрхийн хил бодитоор үйлчилж, frontend өгөгдөж байгаа
# эсэх. CI-ийн docker compose алхам үүнийг ажиллуулдаг.
#
# Урьдчилсан нөхцөл: сервер localhost:3000, seed хийгдсэн.
# Ажиллуулах: bash scripts/smoke-test.sh
# Ул мөр: юу ч үлдээхгүй (зөвхөн уншина).

set -euo pipefail
API=${API:-http://localhost:3000/api}
ROOT=${ROOT:-http://localhost:3000}
H='Content-Type: application/json'

json() { python3 -c "import json,sys; print(json.load(sys.stdin)$1)"; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
ok()   { echo "  OK: $1"; }
fail() { echo "  FAIL: $1"; exit 1; }

echo "── 1. Health ──"
curl -sf $API/health | grep -q '"db":true' && ok "API + DB" || fail "health"

echo "── 2. Frontend өгөгдөж байна ──"
curl -sf $ROOT/ | grep -qi "<div id=\"root\"" && ok "index.html" || fail "frontend"

echo "── 3. Нэвтрэлтгүй хандалт хаалттай ──"
# Нэвтрэлтийн rate limit нь 5/мин (AUTH_RATE_LIMIT) тул сөрөг шалгалтыг
# ЭХЭЛЖ хийгээд, дараа нь хэрэгтэй эрхүүдээр л нэвтэрнэ.
[ "$(code $API/orders)" = "401" ] && ok "401 нэвтрэлтгүй" || fail "нэвтрэлтгүй нээлттэй"
BAD=$(code -X POST $API/auth/login -H "$H" -d '{"email":"admin@ursgal.mn","password":"buruu"}')
case "$BAD" in
  401) ok "401 буруу нууц үг" ;;
  429) fail "429 — нэвтрэлтийн rate limit дүүрсэн. 1 минут хүлээгээд дахин ажиллуулна уу" ;;
  *)   fail "буруу нууц үгээр $BAD ирлээ (401 байх ёстой)" ;;
esac

echo "── 4. Эрх бүр нэвтэрнэ ──"
declare -A TOK
for U in manager seller operator driver; do
  RESP=$(curl -s -X POST $API/auth/login -H "$H" \
    -d "{\"email\":\"$U@ursgal.mn\",\"password\":\"${U}123\"}")
  TOK[$U]=$(echo "$RESP" | json "['accessToken']" 2>/dev/null) \
    || fail "$U нэвтэрч чадсангүй: $(echo "$RESP" | head -c 120)"
  R=$(curl -sf $API/auth/me -H "Authorization: Bearer ${TOK[$U]}" | json "['role']")
  ok "$U → $R"
done

echo "── 5. Эрхийн хил ──"
deny() { local c; c=$(code "${@:2}"); [ "$c" = "403" ] && ok "403 $1" || fail "$1 ($c ирлээ)"; }
# Гаднын харилцагч дотоод мэдээлэлд хүрэхгүй
deny "харилцагч → захиалга"  $API/orders    -H "Authorization: Bearer ${TOK[operator]}"
deny "харилцагч → бараа"     $API/products  -H "Authorization: Bearer ${TOK[operator]}"
# Жолооч зөвхөн өөрийн хүргэлттэй
deny "жолооч → захиалга"     $API/orders    -H "Authorization: Bearer ${TOK[driver]}"
deny "жолооч → хэрэглэгчид"  $API/users     -H "Authorization: Bearer ${TOK[driver]}"
# Борлуулагч санхүүд хүрэхгүй
deny "борлуулагч → санхүү"   $API/finance/summary -H "Authorization: Bearer ${TOK[seller]}"

echo "── 6. Уншилтын үндсэн замууд ──"
for P in orders products drivers dashboard/manager; do
  curl -sf "$API/$P" -H "Authorization: Bearer ${TOK[manager]}" > /dev/null && ok "GET /$P"
done
curl -sf "$API/warehouse/board" -H "Authorization: Bearer ${TOK[manager]}" > /dev/null && ok "GET /warehouse/board"
curl -sf "$API/supplies/balances" -H "Authorization: Bearer ${TOK[manager]}" > /dev/null && ok "GET /supplies/balances"
curl -sf "$API/batches/summary" -H "Authorization: Bearer ${TOK[manager]}" > /dev/null && ok "GET /batches/summary"

echo ""
echo "✓ Smoke test бүрэн амжилттай"
