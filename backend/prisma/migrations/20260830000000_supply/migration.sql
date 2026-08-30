-- Харилцагчийн нийлүүлэлт (V5): хэн, юуг, ямар өртгөөр авчирсан ба
-- бидний өр хэд болохыг бүртгэнэ. Өмнө нь энэ бүхэн Excel дээр байв.
CREATE TABLE "Supply" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "supplierId" TEXT,
    "receivedById" TEXT NOT NULL,
    "totalCost" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Supply_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplyItem" (
    "id" TEXT NOT NULL,
    "supplyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "SupplyItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Supply_number_key" ON "Supply"("number");
CREATE INDEX "Supply_companyId_createdAt_idx" ON "Supply"("companyId", "createdAt");
CREATE INDEX "SupplyItem_supplyId_idx" ON "SupplyItem"("supplyId");

ALTER TABLE "Supply" ADD CONSTRAINT "Supply_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Supply" ADD CONSTRAINT "Supply_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Supply" ADD CONSTRAINT "Supply_receivedById_fkey"
  FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplyItem" ADD CONSTRAINT "SupplyItem_supplyId_fkey"
  FOREIGN KEY ("supplyId") REFERENCES "Supply"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplyItem" ADD CONSTRAINT "SupplyItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
