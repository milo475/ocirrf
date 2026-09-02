-- MULTI-TENANCY (Байгууллага) — олон компани нэг deployment дээр.
--
-- Одоо байгаа бүх өгөгдөл 'ocirrf' нэртэй default байгууллагад
-- харьяалагдана (тогтмол UUID — seed.ts болон тестүүд мөн үүнийг
-- хэрэглэнэ). Хүснэгт бүрт: багана нэмэх → backfill → NOT NULL → FK.
-- Глобал unique-үүд (sku, orderNo, name, number...) байгууллага
-- доторх composite unique болно.
--
-- ДЕПЛОЙ: энэ migration шинэ кодтой ХАМТ атомоор орно
-- (pm2 stop → prisma migrate deploy → шинэ dist → pm2 start).

-- 1. Organization хүснэгт
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "publicOrderToken" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_publicOrderToken_key" ON "Organization"("publicOrderToken");

-- 2. Default байгууллага + одоогийн нийтийн token-ыг шилжүүлэх.
--    Хоосон шинэ DB дээр ч үүснэ (хоргүй) — dev/тест seed мөн энэ
--    UUID-г ашиглана.
INSERT INTO "Organization"("id", "name")
VALUES ('00000000-0000-4000-8000-000000000001', 'ocirrf');

UPDATE "Organization"
SET "publicOrderToken" = (SELECT "value" FROM "Setting" WHERE "key" = 'publicOrderToken')
WHERE "id" = '00000000-0000-4000-8000-000000000001';

-- 3. Хүснэгт бүрт organizationId: нэмэх → backfill → NOT NULL
--    (шууд NOT NULL-ээр нэмбэл өгөгдөлтэй хүснэгтэд унана)

ALTER TABLE "User" ADD COLUMN "organizationId" TEXT;
UPDATE "User" SET "organizationId" = '00000000-0000-4000-8000-000000000001';
ALTER TABLE "User" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "Company" ADD COLUMN "organizationId" TEXT;
UPDATE "Company" SET "organizationId" = '00000000-0000-4000-8000-000000000001';
ALTER TABLE "Company" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "Category" ADD COLUMN "organizationId" TEXT;
UPDATE "Category" SET "organizationId" = '00000000-0000-4000-8000-000000000001';
ALTER TABLE "Category" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "Product" ADD COLUMN "organizationId" TEXT;
UPDATE "Product" SET "organizationId" = '00000000-0000-4000-8000-000000000001';
ALTER TABLE "Product" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "Order" ADD COLUMN "organizationId" TEXT;
UPDATE "Order" SET "organizationId" = '00000000-0000-4000-8000-000000000001';
ALTER TABLE "Order" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "OrderRequest" ADD COLUMN "organizationId" TEXT;
UPDATE "OrderRequest" SET "organizationId" = '00000000-0000-4000-8000-000000000001';
ALTER TABLE "OrderRequest" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "OrderReturn" ADD COLUMN "organizationId" TEXT;
UPDATE "OrderReturn" SET "organizationId" = '00000000-0000-4000-8000-000000000001';
ALTER TABLE "OrderReturn" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "Supply" ADD COLUMN "organizationId" TEXT;
UPDATE "Supply" SET "organizationId" = '00000000-0000-4000-8000-000000000001';
ALTER TABLE "Supply" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "DriverHandover" ADD COLUMN "organizationId" TEXT;
UPDATE "DriverHandover" SET "organizationId" = '00000000-0000-4000-8000-000000000001';
ALTER TABLE "DriverHandover" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "Payment" ADD COLUMN "organizationId" TEXT;
UPDATE "Payment" SET "organizationId" = '00000000-0000-4000-8000-000000000001';
ALTER TABLE "Payment" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "FinanceEntry" ADD COLUMN "organizationId" TEXT;
UPDATE "FinanceEntry" SET "organizationId" = '00000000-0000-4000-8000-000000000001';
ALTER TABLE "FinanceEntry" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "DriverPayout" ADD COLUMN "organizationId" TEXT;
UPDATE "DriverPayout" SET "organizationId" = '00000000-0000-4000-8000-000000000001';
ALTER TABLE "DriverPayout" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "StockMovement" ADD COLUMN "organizationId" TEXT;
UPDATE "StockMovement" SET "organizationId" = '00000000-0000-4000-8000-000000000001';
ALTER TABLE "StockMovement" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "ProductBatch" ADD COLUMN "organizationId" TEXT;
UPDATE "ProductBatch" SET "organizationId" = '00000000-0000-4000-8000-000000000001';
ALTER TABLE "ProductBatch" ALTER COLUMN "organizationId" SET NOT NULL;

-- 4. Setting: PK нь (organizationId, key) хос болно.
--    publicOrderToken Organization руу нүүсэн тул мөрийг нь устгана.
ALTER TABLE "Setting" ADD COLUMN "organizationId" TEXT;
DELETE FROM "Setting" WHERE "key" = 'publicOrderToken';
UPDATE "Setting" SET "organizationId" = '00000000-0000-4000-8000-000000000001';
ALTER TABLE "Setting" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Setting" DROP CONSTRAINT "Setting_pkey";
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_pkey" PRIMARY KEY ("organizationId", "key");

-- 5. ActivityLog: nullable үлдэнэ (нэвтрэлтийн өмнөх security event
--    байгууллагагүй) — хуучин мөрүүд default байгууллагад
ALTER TABLE "ActivityLog" ADD COLUMN "organizationId" TEXT;
UPDATE "ActivityLog" SET "organizationId" = '00000000-0000-4000-8000-000000000001';

-- 6. Глобал unique → байгууллага доторх composite unique
DROP INDEX "Company_name_key";
CREATE UNIQUE INDEX "Company_organizationId_name_key" ON "Company"("organizationId", "name");

DROP INDEX "Category_name_key";
CREATE UNIQUE INDEX "Category_organizationId_name_key" ON "Category"("organizationId", "name");

DROP INDEX "Product_sku_key";
DROP INDEX "Product_barcode_key";
CREATE UNIQUE INDEX "Product_organizationId_sku_key" ON "Product"("organizationId", "sku");
CREATE UNIQUE INDEX "Product_organizationId_barcode_key" ON "Product"("organizationId", "barcode");

DROP INDEX "Order_orderNo_key";
CREATE UNIQUE INDEX "Order_organizationId_orderNo_key" ON "Order"("organizationId", "orderNo");

DROP INDEX "Supply_number_key";
CREATE UNIQUE INDEX "Supply_organizationId_number_key" ON "Supply"("organizationId", "number");

DROP INDEX "DriverHandover_number_key";
CREATE UNIQUE INDEX "DriverHandover_organizationId_number_key" ON "DriverHandover"("organizationId", "number");

-- 7. Байгууллагаар шүүх index-үүд
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");
CREATE INDEX "OrderRequest_organizationId_idx" ON "OrderRequest"("organizationId");
CREATE INDEX "OrderReturn_organizationId_idx" ON "OrderReturn"("organizationId");
CREATE INDEX "Payment_organizationId_idx" ON "Payment"("organizationId");
CREATE INDEX "FinanceEntry_organizationId_idx" ON "FinanceEntry"("organizationId");
CREATE INDEX "DriverPayout_organizationId_idx" ON "DriverPayout"("organizationId");
CREATE INDEX "StockMovement_organizationId_idx" ON "StockMovement"("organizationId");
CREATE INDEX "ProductBatch_organizationId_idx" ON "ProductBatch"("organizationId");
CREATE INDEX "Product_organizationId_isActive_idx" ON "Product"("organizationId", "isActive");
CREATE INDEX "ActivityLog_organizationId_createdAt_idx" ON "ActivityLog"("organizationId", "createdAt");

-- 8. Foreign key-үүд
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Company" ADD CONSTRAINT "Company_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Category" ADD CONSTRAINT "Category_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderRequest" ADD CONSTRAINT "OrderRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderReturn" ADD CONSTRAINT "OrderReturn_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Supply" ADD CONSTRAINT "Supply_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DriverHandover" ADD CONSTRAINT "DriverHandover_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DriverPayout" ADD CONSTRAINT "DriverPayout_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductBatch" ADD CONSTRAINT "ProductBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
