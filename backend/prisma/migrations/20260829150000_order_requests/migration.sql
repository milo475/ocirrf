-- Нийтийн линкээр ирэх захиалгын хүсэлт (V5) — үлдэгдэлд хүрэхгүй
CREATE TYPE "OrderRequestStatus" AS ENUM ('NEW', 'CONVERTED', 'REJECTED');

CREATE TABLE "OrderRequest" (
  "id" TEXT NOT NULL,
  "status" "OrderRequestStatus" NOT NULL DEFAULT 'NEW',
  "customerName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "extraPhone" TEXT,
  "socialName" TEXT,
  "channel" "OrderChannel" NOT NULL DEFAULT 'OTHER',
  "region" "DeliveryRegion" NOT NULL DEFAULT 'ULAANBAATAR',
  "district" TEXT, "khoroo" TEXT, "building" TEXT,
  "entrance" TEXT, "floor" TEXT, "door" TEXT,
  "province" TEXT, "soum" TEXT, "transport" TEXT,
  "addressDetail" TEXT, "note" TEXT,
  "paid" BOOLEAN NOT NULL DEFAULT false,
  "paymentProofUrl" TEXT,
  "orderId" TEXT,
  "handledById" TEXT,
  "handledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrderRequest_status_createdAt_idx" ON "OrderRequest"("status", "createdAt");

CREATE TABLE "OrderRequestItem" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "qty" INTEGER NOT NULL,
  CONSTRAINT "OrderRequestItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrderRequestItem_requestId_idx" ON "OrderRequestItem"("requestId");
ALTER TABLE "OrderRequestItem" ADD CONSTRAINT "OrderRequestItem_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "OrderRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
