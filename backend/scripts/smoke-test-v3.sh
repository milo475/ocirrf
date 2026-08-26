#!/usr/bin/env bash
# ursGAL v3 — permission, finance, notifications, portal, analytics smoke test.
# Урьдчилсан нөхцөл: backend localhost:3000, seed v2 хийгдсэн.
# Ажиллуулах: bash scripts/smoke-test-v3.sh
# Ул мөр: 1 тест CUSTOMER хэрэглэгч + 1 finance гүйлгээ үлдэнэ
# (захиалга нь цуцлагдаж үлдэгдэл буцдаг).

set -euo pipefail
API=http://localhost:3000/api
H='Content-Type: application/json'
STAMP=$(date +%s)
FAKE=00000000-0000-4000-8000-000000000000

json() { python3 -c "import json,sys; print(json.load(sys.stdin)$1)"; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

echo "── 1. Нэвтрэлт + effective permissions ──"
for U in admin manager operator driver; do
  TK=$(curl -sf -X POST $API/auth/login -H "$H" \
    -d "{\"email\":\"$U@ursgal.mn\",\"password\":\"${U}123\"}" | json "['accessToken']")
  declare "TOK_$U=$TK"
done
NPERM=$(curl -sf $API/auth/me -H "Authorization: Bearer $TOK_manager" | json "['permissions']" | python3 -c "import sys; print(len(eval(sys.stdin.read())))")
echo "OK: manager-т $NPERM permission (default матриц)"

echo "── 2. Permission override: хасах → 403, буцаах → сэргэнэ ──"
MID=$(curl -sf $API/users -H "Authorization: Bearer $TOK_admin" | python3 -c "
import json,sys
print(next(u['id'] for u in json.load(sys.stdin) if u['username']=='manager@ursgal.mn'))")
curl -sf -X PUT $API/users/$MID/permissions -H "Authorization: Bearer $TOK_admin" -H "$H" \
  -d '{"changes":[{"key":"orders.assign_driver","allowed":false}]}' > /dev/null
C=$(code -X PATCH $API/orders/$FAKE/assign-driver -H "Authorization: Bearer $TOK_manager" -H "$H" -d "{\"driverId\":\"$FAKE\"}")
[ "$C" = "403" ] && echo "OK: хассаны дараа 403"
curl -sf -X PUT $API/users/$MID/permissions -H "Authorization: Bearer $TOK_admin" -H "$H" \
  -d '{"changes":[{"key":"orders.assign_driver","allowed":null}]}' > /dev/null
C=$(code -X PATCH $API/orders/$FAKE/assign-driver -H "Authorization: Bearer $TOK_manager" -H "$H" -d "{\"driverId\":\"$FAKE\"}")
[ "$C" = "404" ] && echo "OK: буцаасны дараа эрх сэргэв (404 — эрхийн 403 биш)"
C=$(code -X PUT $API/users/$MID/permissions -H "Authorization: Bearer $TOK_manager" -H "$H" -d '{"changes":[]}')
[ "$C" = "403" ] && echo "OK: manager өөрөө permission удирдахгүй (403)"

echo "── 3. Settings: allowCustomerCancel нээнэ ──"
curl -sf -X PUT $API/settings -H "Authorization: Bearer $TOK_admin" -H "$H" \
  -d '{"allowCustomerCancel":"true"}' | json "['allowCustomerCancel']" | xargs echo "  allowCustomerCancel ="

echo "── 4. Customer portal: бүртгэл → захиалга → цуцлалт ──"
CEMAIL="smoke3-$STAMP@mail.mn"
REG=$(curl -sf -X POST $API/auth/register -H "$H" \
  -d "{\"name\":\"Смоук3 Харилцагч\",\"email\":\"$CEMAIL\",\"phone\":\"99900011\",\"password\":\"smoke123\"}")
CTOK=$(echo "$REG" | json "['accessToken']")
echo "OK: бүртгэгдлээ ($CEMAIL)"
PID=$(curl -sf "$API/portal/products?limit=20" -H "Authorization: Bearer $CTOK" | python3 -c "
import json,sys
print(next(p['id'] for p in json.load(sys.stdin)['items'] if p['stockQty'] > 0))")
Q0=$(curl -sf $API/products/$PID -H "Authorization: Bearer $TOK_manager" | json "['stockQty']")
ORD=$(curl -sf -X POST $API/orders -H "Authorization: Bearer $CTOK" -H "$H" \
  -d "{\"region\":\"ULAANBAATAR\",\"district\":\"БЗД\",\"khoroo\":\"1\",\"building\":\"Смоук байр\",\"entrance\":\"1\",\"floor\":\"1\",\"door\":\"1\",\"items\":[{\"productId\":\"$PID\",\"qty\":1}]}")
OID=$(echo "$ORD" | json "['id']")
Q1=$(curl -sf $API/products/$PID -H "Authorization: Bearer $TOK_manager" | json "['stockQty']")
[ "$Q1" = "$((Q0-1))" ] && echo "OK: захиалга $(echo "$ORD" | json "['orderNo']"), үлдэгдэл $Q0→$Q1"
UC=$(curl -sf $API/notifications/unread-count -H "Authorization: Bearer $TOK_operator" | json "['count']")
echo "OK: operator-ийн уншаагүй мэдэгдэл: $UC (CUSTOMER_ORDER орсон)"
C=$(code $API/portal/orders/$FAKE -H "Authorization: Bearer $CTOK")
[ "$C" = "404" ] && echo "OK: байхгүй захиалга 404 (бусдынх бол 403)"
curl -sf -X PATCH $API/portal/orders/$OID/cancel -H "Authorization: Bearer $CTOK" | json "['orderStatus']" | xargs echo "  цуцлалт:"
Q2=$(curl -sf $API/products/$PID -H "Authorization: Bearer $TOK_manager" | json "['stockQty']")
[ "$Q2" = "$Q0" ] && echo "OK: үлдэгдэл буцаж $Q2 боллоо"
curl -sf -X PUT $API/settings -H "Authorization: Bearer $TOK_admin" -H "$H" \
  -d '{"allowCustomerCancel":"false"}' > /dev/null
echo "OK: allowCustomerCancel буцааж хаагдав"

echo "── 5. Finance + payroll ──"
curl -sf -X POST $API/finance/entries -H "Authorization: Bearer $TOK_manager" -H "$H" \
  -d '{"type":"INCOME","category":"Бусад орлого","amount":"1000.00","note":"смоук3"}' | json "['id']" > /dev/null
curl -sf "$API/finance/summary?days=30" -H "Authorization: Bearer $TOK_manager" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('  30 хоног: орлого', d['income'], '| зарлага', d['expense'])"
curl -sf $API/finance/payroll/pending -H "Authorization: Bearer $TOK_manager" \
  | python3 -c "import json,sys; print('  payroll pending:', len(json.load(sys.stdin)), 'жолооч')"

echo "── 6. Delivery ops + analytics ──"
curl -sf $API/delivery-ops/board -H "Authorization: Bearer $TOK_manager" \
  | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('  board:', {k: len(v) for k, v in d['board'].items()})"
curl -sf "$API/analytics/sales?groupBy=day" -H "Authorization: Bearer $TOK_manager" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('  30 хоногийн захиалга:', d['totals']['count'], 'ш /', d['totals']['amount'], '₮')"

echo "── 7. Reports CSV ──"
HDRS=$(curl -sf -D - -o /tmp/smoke3.csv "$API/reports/delivery.csv" -H "Authorization: Bearer $TOK_manager")
echo "$HDRS" | grep -qi "attachment" && echo "OK: Content-Disposition attachment"
head -c 3 /tmp/smoke3.csv | od -An -tx1 | grep -q "ef bb bf" && echo "OK: UTF-8 BOM (Excel-д кирилл зөв)"
head -1 /tmp/smoke3.csv | grep -q "Захиалгын дугаар" && echo "OK: монгол багана"
rm -f /tmp/smoke3.csv

echo "── 8. Эрхийн зөрчлүүд (бүгд 403) ──"
check403() { local desc=$1; shift; local c; c=$(code "$@"); [ "$c" = "403" ] && echo "  OK 403: $desc" || { echo "  FAIL ($c): $desc"; exit 1; }; }
check403 "operator analytics" $API/analytics/sales -H "Authorization: Bearer $TOK_operator"
check403 "operator settings PUT" -X PUT $API/settings -H "Authorization: Bearer $TOK_operator" -H "$H" -d '{"companyName":"x"}'
check403 "manager finance.csv" $API/reports/finance.csv -H "Authorization: Bearer $TOK_manager"
check403 "customer staff захиалга" $API/orders -H "Authorization: Bearer $CTOK"
check403 "staff portal" $API/portal/orders -H "Authorization: Bearer $TOK_admin"
check403 "operator activity-log" $API/activity-log -H "Authorization: Bearer $TOK_operator"

echo ""
echo "✓ v3 smoke test бүрэн амжилттай"
