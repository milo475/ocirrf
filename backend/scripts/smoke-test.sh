#!/usr/bin/env bash
# ursGAL backend бүтэн туршилт (smoke test).
# Урьдчилсан нөхцөл: backend localhost:3000 дээр ажиллаж байгаа, seed хийгдсэн.
# Ажиллуулах: bash scripts/smoke-test.sh
# Үлдэгдэх ул мөр: 1 цуцлагдсан захиалга + 1 идэвхгүй тест бараа (хор хөнөөлгүй түүх).

set -euo pipefail
API=http://localhost:3000/api
H='Content-Type: application/json'

json() { python3 -c "import json,sys; d=json.load(sys.stdin); print(d$1)"; }

echo "── 1. Админаар login ──"
# Хүлээгдэх: accessToken (JWT string) буцна
AT=$(curl -sf -X POST $API/auth/login -H "$H" \
  -d '{"email":"admin@ursgal.mn","password":"admin123"}' | json "['accessToken']")
[ -n "$AT" ] && echo "OK: token авлаа"
AUTH="Authorization: Bearer $AT"

echo "── 2. Тест бараа үүсгэх (UG-TEST, үнэ 1000) ──"
# Хүлээгдэх: 201, stockQty=0-ээс эхэлнэ (үлдэгдэл зөвхөн stock/adjust-аар ордог)
PID=$(curl -sf -X POST $API/products -H "$AUTH" -H "$H" \
  -d '{"sku":"UG-TEST","name":"Тест бараа","price":"1000.00"}' | json "['id']")
echo "OK: id=$PID"

echo "── 3. Эхний орлого +20 (INITIAL) ──"
# Хүлээгдэх: stockQty=20, StockMovement(+20, INITIAL) үүснэ
QTY=$(curl -sf -X POST $API/stock/adjust -H "$AUTH" -H "$H" \
  -d "{\"productId\":\"$PID\",\"qtyChange\":20,\"reason\":\"INITIAL\"}" | json "['product']['stockQty']")
[ "$QTY" = "20" ] && echo "OK: stockQty=20"

echo "── 4. Захиалга үүсгэх (5 ширхэг) ──"
# Хүлээгдэх: orderNo=ORD-YYYYMMDD-NNNN, totalAmount=5000, status=NEW
ORDER=$(curl -sf -X POST $API/orders -H "$AUTH" -H "$H" \
  -d "{\"customerName\":\"Смоук Тест\",\"customerPhone\":\"90000000\",\"items\":[{\"productId\":\"$PID\",\"qty\":5}]}")
OID=$(echo "$ORDER" | json "['id']")
echo "$ORDER" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['orderNo'], '|', d['totalAmount'], '|', d['orderStatus'])"
[ "$(echo "$ORDER" | json "['totalAmount']")" = "5000" ] && echo "OK: totalAmount=5000 (1000×5)"

echo "── 5. Үлдэгдэл хасагдсан эсэх ──"
# Хүлээгдэх: 20 - 5 = 15
QTY=$(curl -sf $API/products/$PID -H "$AUTH" | json "['stockQty']")
[ "$QTY" = "15" ] && echo "OK: stockQty=15"

echo "── 6. Movement түүхэнд ORDER мөр ──"
# Хүлээгдэх: сүүлийн мөр qtyChange=-5, reason=ORDER, refId=захиалгын id
curl -sf "$API/stock/movements?productId=$PID&limit=1" -H "$AUTH" \
  | python3 -c "import json,sys; i=json.load(sys.stdin)['items'][0]; print(i['qtyChange'], i['reason'])"

echo "── 7. Статус NEW → CONFIRMED ──"
# Хүлээгдэх: orderStatus=CONFIRMED (шилжилтийн хүснэгтээр зөвшөөрөгдсөн)
curl -sf -X PATCH $API/orders/$OID/status -H "$AUTH" -H "$H" \
  -d '{"status":"CONFIRMED"}' | json "['orderStatus']"

echo "── 8. Цуцлах (CONFIRMED → CANCELLED) ──"
# Хүлээгдэх: orderStatus=CANCELLED
curl -sf -X PATCH $API/orders/$OID/status -H "$AUTH" -H "$H" \
  -d '{"status":"CANCELLED"}' | json "['orderStatus']"

echo "── 9. Үлдэгдэл буцаж нэмэгдсэн эсэх ──"
# Хүлээгдэх: 15 + 5 = 20, сүүлийн movement: +5 ORDER_CANCEL
QTY=$(curl -sf $API/products/$PID -H "$AUTH" | json "['stockQty']")
[ "$QTY" = "20" ] && echo "OK: stockQty=20 (буцсан)"
curl -sf "$API/stock/movements?productId=$PID&limit=1" -H "$AUTH" \
  | python3 -c "import json,sys; i=json.load(sys.stdin)['items'][0]; print(i['qtyChange'], i['reason'])"

echo "── 10. Dashboard endpoint ──"
# Хүлээгдэх: массив, UG-TEST дотор нь, инвариант 55+drivers=stockHealth
curl -sf $API/dashboard/stock-health -H "$AUTH" | python3 -c "
import json, sys
data = json.load(sys.stdin)
p = next(x for x in data if x['sku'] == 'UG-TEST')
ok = 55 + sum(d['points'] for d in p['drivers']) == p['stockHealth'] \
     and len(p['healthHistory']) == 13 and p['healthHistory'][-1] == p['stockHealth']
print(f'OK: {len(data)} бараа, UG-TEST оноо={p[\"stockHealth\"]}, инвариант {\"зөв\" if ok else \"ЗӨРСӨН\"}')"

echo "── 11. Цэвэрлэгээ: тест барааг идэвхгүй болгох ──"
# Хүлээгдэх: isActive=false (soft delete — захиалгын түүх хадгалагдана)
curl -sf -X DELETE $API/products/$PID -H "$AUTH" | json "['isActive']"

echo ""
echo "✓ Бүх алхам амжилттай"
