-- Барааны цуврал ба дуусах хугацаа (V5).
-- Хүнсний нэмэлт бүтээгдэхүүнд хугацаа заавал хянагдана; Product.stockQty
-- нь үлдэгдлийн эх сурвалж хэвээр, цуврал нь түүнийг хугацаагаар задална.
CREATE TABLE "ProductBatch" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchNo" TEXT,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "qty" INTEGER NOT NULL,
    "remaining" INTEGER NOT NULL,
    "supplyId" TEXT,
    "writtenOffAt" TIMESTAMP(3),
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductBatch_productId_expiryDate_idx" ON "ProductBatch"("productId", "expiryDate");
CREATE INDEX "ProductBatch_expiryDate_idx" ON "ProductBatch"("expiryDate");

ALTER TABLE "ProductBatch" ADD CONSTRAINT "ProductBatch_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductBatch" ADD CONSTRAINT "ProductBatch_supplyId_fkey"
  FOREIGN KEY ("supplyId") REFERENCES "Supply"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductBatch" ADD CONSTRAINT "ProductBatch_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
