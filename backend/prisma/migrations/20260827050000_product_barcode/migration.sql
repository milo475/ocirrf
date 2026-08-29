-- V4-12: barcode багана + unique индекс
ALTER TABLE "Product" ADD COLUMN "barcode" TEXT;
CREATE UNIQUE INDEX "Product_barcode_key" ON "Product"("barcode");
