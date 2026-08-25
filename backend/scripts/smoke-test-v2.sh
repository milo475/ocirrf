#!/usr/bin/env bash
# ursGAL v2 — 4 эрхийн бүтэн туршилт (smoke test).
# Урьдчилсан нөхцөл: backend localhost:3000, seed v2 хийгдсэн.
# Ажиллуулах: bash scripts/smoke-test-v2.sh
# Ул мөр: 1 хүргэгдсэн тест захиалга + 1 тест бараа + 1 proof зураг үлдэнэ.

set -euo pipefail
API=http://localhost:3000/api
H='Content-Type: application/json'
STAMP=$(date +%s)
SKU="UG-S$STAMP"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

json() { python3 -c "import json,sys; print(json.load(sys.stdin)$1)"; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

echo "── 1. 4 эрхээр login ──"
# Хүлээгдэх: 4 token
for U in admin manager operator driver; do
  TK=$(curl -sf -X POST $API/auth/login -H "$H" \
    -d "{\"email\":\"$U@ursgal.mn\",\"password\":\"${U}123\"}" | json "['accessToken']")
  declare "TOK_$U=$TK"
done
echo "OK: admin/manager/operator/driver"
DRIVER_ID=$(curl -sf $API/auth/me -H "Authorization: Bearer $TOK_driver" | json "['id']")

echo "── 2. MANAGER бараа үүсгэж, орлого авна ──"
# Хүлээгдэх: бараа үүсч (limit 8), PURCHASE_IN 12 → qty 12
PID=$(curl -sf -X POST $API/products -H "Authorization: Bearer $TOK_manager" -H "$H" \
  -d "{\"sku\":\"$SKU\",\"name\":\"Смоук v2 бараа\",\"price\":\"2000.00\",\"lowStockLimit\":8}" | json "['id']")
QTY=$(curl -sf -X POST $API/stock/adjust -H "Authorization: Bearer $TOK_manager" -H "$H" \
  -d "{\"productId\":\"$PID\",\"qtyChange\":12,\"reason\":\"PURCHASE_IN\",\"note\":\"смоук тест\"}" | json "['product']['stockQty']")
[ "$QTY" = "12" ] && echo "OK: qty=12"

echo "── 3. OPERATOR захиалга шивнэ (хаягтай) ──"
# Хүлээгдэх: NEW захиалга, үлдэгдэл 12→9
ORD=$(curl -sf -X POST $API/orders -H "Authorization: Bearer $TOK_operator" -H "$H" \
  -d "{\"customerName\":\"Смоук Харилцагч\",\"customerPhone\":\"99112233\",\"region\":\"ULAANBAATAR\",\"district\":\"БЗД\",\"khoroo\":\"14\",\"building\":\"45-р байр\",\"entrance\":\"1\",\"floor\":\"3\",\"door\":\"33\",\"items\":[{\"productId\":\"$PID\",\"qty\":3}]}")
OID=$(echo "$ORD" | json "['id']")
echo "OK: $(echo "$ORD" | json "['orderNo']") ($(echo "$ORD" | json "['totalAmount']")₮)"

echo "── 4. OPERATOR баталгаажуулж, MANAGER жолооч хуваарилна ──"
# Хүлээгдэх: CONFIRMED → deliveryStatus=ASSIGNED
curl -sf -X PATCH $API/orders/$OID/status -H "Authorization: Bearer $TOK_operator" -H "$H" \
  -d '{"status":"CONFIRMED"}' > /dev/null
DS=$(curl -sf -X PATCH $API/orders/$OID/assign-driver -H "Authorization: Bearer $TOK_manager" -H "$H" \
  -d "{\"driverId\":\"$DRIVER_ID\"}" | json "['deliveryStatus']")
[ "$DS" = "ASSIGNED" ] && echo "OK: ASSIGNED"

echo "── 5. DRIVER /my-д харагдана ──"
# Хүлээгдэх: жагсаалтад шинэ захиалга бий
curl -sf $API/deliveries/my -H "Authorization: Bearer $TOK_driver" \
  | python3 -c "
import json,sys
d = json.load(sys.stdin)
row = next(x for x in d if x['id'] == '$OID')
print('OK:', row['orderNo'], '|', row['fullAddress'], '|', len(row['items']), 'мөр')"

echo "── 6. DRIVER зурагтай баталгаажуулна ──"
# Хүлээгдэх: DELIVERED + зураг serve хийгдэнэ
python3 -c "
import struct, zlib
def chunk(t, d):
    c = t + d
    return struct.pack('>I', len(d)) + c + struct.pack('>I', zlib.crc32(c))
ihdr = struct.pack('>IIBBBBB', 8, 8, 8, 2, 0, 0, 0)
raw = b''.join(b'\x00' + b'\x20\x90\x40' * 8 for _ in range(8))
open('$TMP/p.png','wb').write(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',ihdr)+chunk(b'IDAT',zlib.compress(raw))+chunk(b'IEND',b''))"
PROOF=$(curl -sf -X POST $API/deliveries/$OID/complete -H "Authorization: Bearer $TOK_driver" \
  -F "success=true" -F "photo=@$TMP/p.png;type=image/png" | json "['deliveryProofUrl']")
PCODE=$(code http://localhost:3000$PROOF)
[ "$PCODE" = "200" ] && echo "OK: DELIVERED, зураг $PROOF → 200"

echo "── 7. 4 dashboard тус бүр ──"
# Хүлээгдэх: бүгд 200, өөрийн бүтэцтэй
curl -sf $API/dashboard/admin -H "Authorization: Bearer $TOK_admin" | json "['deliveredTotal']" | xargs echo "  admin: deliveredTotal ="
curl -sf $API/dashboard/manager -H "Authorization: Bearer $TOK_manager" | json "['stockLast7Days'][-1]" | xargs echo "  manager: өнөөдөр ="
curl -sf $API/dashboard/operator -H "Authorization: Bearer $TOK_operator" | python3 -c "import json,sys; d=json.load(sys.stdin); print('  operator: миний захиалга', d['myOrdersTotal'], '| lowStock', len(d['lowStockProducts']))"
curl -sf $API/dashboard/driver -H "Authorization: Bearer $TOK_driver" | python3 -c "import json,sys; d=json.load(sys.stdin); print('  driver: хүргэсэн', d['totalDelivered'], '| цалин', d['earnings'])"

echo "── 8. Эрхийн зөрчлүүд (бүгд 403 байх ёстой) ──"
check403() { local desc=$1; shift; local c; c=$(code "$@"); [ "$c" = "403" ] && echo "  OK 403: $desc" || { echo "  FAIL ($c): $desc"; exit 1; }; }
check403 "driver бараа үүсгэх" -X POST $API/products -H "Authorization: Bearer $TOK_driver" -H "$H" -d '{"sku":"X","name":"X","price":"1"}'
check403 "driver бараа харах" $API/products -H "Authorization: Bearer $TOK_driver"
check403 "driver бүх захиалга харах" $API/orders -H "Authorization: Bearer $TOK_driver"
check403 "operator stock adjust" -X POST $API/stock/adjust -H "Authorization: Bearer $TOK_operator" -H "$H" -d "{\"productId\":\"$PID\",\"qtyChange\":1,\"reason\":\"CORRECTION\"}"
check403 "manager захиалга үүсгэх" -X POST $API/orders -H "Authorization: Bearer $TOK_manager" -H "$H" -d '{"customerName":"X","customerPhone":"1","address":"x","items":[]}'
check403 "operator хэрэглэгчид харах" $API/users -H "Authorization: Bearer $TOK_operator"
check403 "manager admin dashboard" $API/dashboard/admin -H "Authorization: Bearer $TOK_manager"
check403 "admin driver dashboard" $API/dashboard/driver -H "Authorization: Bearer $TOK_admin"

echo ""
echo "✓ v2 smoke test бүрэн амжилттай"
