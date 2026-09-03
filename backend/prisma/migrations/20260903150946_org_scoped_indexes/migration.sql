-- ORG-SCOPED INDEX АУДИТ (2026-09-03).
-- Org-scope extension query бүрт organizationId шүүлт нэмдэг тул scoped хүснэгт
-- бүр organizationId-ээр эхэлсэн, жагсаалтын үндсэн эрэмбэтэй хослуулсан
-- composite index-тэй болно. Хуучин [organizationId] дан index нь шинэ
-- composite-ийн prefix тул давхардлыг хасав. Өгөгдөл хөндөгдөхгүй; rollback = DROP INDEX.

-- DropIndex
DROP INDEX "DriverPayout_organizationId_idx";

-- DropIndex
DROP INDEX "FinanceEntry_organizationId_idx";

-- DropIndex
DROP INDEX "OrderRequest_organizationId_idx";

-- DropIndex
DROP INDEX "ProductBatch_organizationId_idx";

-- DropIndex
DROP INDEX "StockMovement_organizationId_idx";

-- CreateIndex
CREATE INDEX "DriverHandover_organizationId_createdAt_idx" ON "DriverHandover"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "DriverPayout_organizationId_periodEnd_idx" ON "DriverPayout"("organizationId", "periodEnd");

-- CreateIndex
CREATE INDEX "FinanceEntry_organizationId_entryDate_idx" ON "FinanceEntry"("organizationId", "entryDate");

-- CreateIndex
CREATE INDEX "Order_organizationId_createdAt_idx" ON "Order"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderRequest_organizationId_status_createdAt_idx" ON "OrderRequest"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ProductBatch_organizationId_expiryDate_idx" ON "ProductBatch"("organizationId", "expiryDate");

-- CreateIndex
CREATE INDEX "StockMovement_organizationId_createdAt_idx" ON "StockMovement"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Supply_organizationId_createdAt_idx" ON "Supply"("organizationId", "createdAt");

