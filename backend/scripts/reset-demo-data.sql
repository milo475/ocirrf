-- ═══════════════════════════════════════════════════════════════
-- ДЕМО ӨГӨГДЛИЙГ ЦЭВЭРЛЭХ — бодит ажиллагаанд орохын ӨМНӨ нэг удаа
-- ═══════════════════════════════════════════════════════════════
--
-- ЯАГААД ХЭРЭГТЭЙ ВЭ:
-- Хөгжүүлэлтийн явцад үүссэн жишээ захиалга, бараа, гүйлгээ нь
-- тайланд бодит тоотой хольж орно. Тухайлбал хуучин кодын үлдээсэн
-- 29 «орлого» бичилт нь ямар ч төлбөргүй байсан атлаа орлогод
-- тоологдож, ижил мөнгө нь АВЛАГА дээр давхар зогсож байв —
-- санхүүгийн тайлан 77%-иар хөөрөгдөж байсан.
--
-- ЮУ ҮЛДЭХ ВЭ:
--   • Хэрэглэгчид ба тэдний эрхийн тохиргоо
--   • Системийн тохиргоо (банкны данс, мессежийн загвар, нийтийн
--     захиалгын линкийн token)
--   • Жолоочийн профайл ба дүүргийн хуваарилалт
--   • moringa 210g — жинхэнэ бүтээгдэхүүн (үлдэгдэл 0 болно)
--
-- ЮУ УСТАХ ВЭ:
--   Захиалга, төлбөр, санхүүгийн бичилт, буцаалт, захиалгын хүсэлт,
--   хүргэлтийн хуудас, цалингийн тооцоо, агуулахын хөдөлгөөн,
--   цуврал, нийлүүлэлт, компани, мэдэгдэл, үйлдлийн түүх,
--   демо бараа ба ангилал.
--
-- ⚠ ЭРГЭШГҮЙ. Шууд бүү ажиллуул — reset-demo-data.sh-г ашиглана уу,
--   тэр нь нөөцлөлт аваад, баталгаажуулалт асууна.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- Хамааралтай мөрүүдийг эхлээд (гадаад түлхүүрийн дараалал)
DELETE FROM "OrderReturnItem";
DELETE FROM "OrderReturn";
DELETE FROM "FinanceEntry";
DELETE FROM "Payment";
DELETE FROM "OrderItem";
DELETE FROM "OrderRequestItem";
DELETE FROM "OrderRequest";
DELETE FROM "Notification";
DELETE FROM "ActivityLog";

-- Захиалгууд хүлээлгэлтийн хуудас руу заадаг тул эхлээд салгана
UPDATE "Order" SET "handoverId" = NULL;
DELETE FROM "Order";
DELETE FROM "DriverHandover";
DELETE FROM "DriverPayout";

DELETE FROM "StockMovement";
DELETE FROM "ProductBatch";
DELETE FROM "SupplyItem";
DELETE FROM "Supply";
DELETE FROM "Company";

-- moringa-г ангиллаас нь салгаж, үлдэгдлийг тэглэж ҮЛДЭЭНЭ
UPDATE "Product" SET "categoryId" = NULL, "stockQty" = 0
WHERE sku = 'UG-32323232';
DELETE FROM "Product" WHERE sku <> 'UG-32323232';
DELETE FROM "Category";

COMMIT;

-- ── Шалгалт: үлдэгдэл ↔ хөдөлгөөний нийлбэр тэнцсэн байх ёстой ──
SELECT count(*) AS zoruutei_baraa_0_baih_yostoi
FROM (
  SELECT p.id
  FROM "Product" p
  LEFT JOIN "StockMovement" m ON m."productId" = p.id
  GROUP BY p.id, p."stockQty"
  HAVING p."stockQty" <> COALESCE(SUM(m."qtyChange"), 0)
) x;
