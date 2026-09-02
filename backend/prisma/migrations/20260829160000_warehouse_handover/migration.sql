-- Нярав эрх + хүлээлгэн өгөх хуудас (V5)
ALTER TYPE "Role" ADD VALUE 'WAREHOUSE';

CREATE TABLE "DriverHandover" (
  "id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "keeperId" TEXT NOT NULL,
  "note" TEXT,
  "keeperSignature" TEXT,
  "driverSignature" TEXT,
  "handedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DriverHandover_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DriverHandover_number_key" ON "DriverHandover"("number");
CREATE INDEX "DriverHandover_driverId_createdAt_idx" ON "DriverHandover"("driverId", "createdAt");
ALTER TABLE "DriverHandover" ADD CONSTRAINT "DriverHandover_driverId_fkey"
  FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DriverHandover" ADD CONSTRAINT "DriverHandover_keeperId_fkey"
  FOREIGN KEY ("keeperId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Order" ADD COLUMN "warehouseId" TEXT;
ALTER TABLE "Order" ADD COLUMN "handoverId" TEXT;
ALTER TABLE "Order" ADD CONSTRAINT "Order_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_handoverId_fkey"
  FOREIGN KEY ("handoverId") REFERENCES "DriverHandover"("id") ON DELETE SET NULL ON UPDATE CASCADE;
