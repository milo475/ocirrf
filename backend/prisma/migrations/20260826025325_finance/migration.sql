-- CreateEnum
CREATE TYPE "FinanceType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PAID');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "payoutId" TEXT;

-- CreateTable
CREATE TABLE "FinanceEntry" (
    "id" TEXT NOT NULL,
    "type" "FinanceType" NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "refOrderId" TEXT,
    "createdById" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverPayout" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "deliveredCount" INTEGER NOT NULL,
    "feePerDelivery" DECIMAL(12,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,

    CONSTRAINT "DriverPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinanceEntry_type_entryDate_idx" ON "FinanceEntry"("type", "entryDate");

-- CreateIndex
CREATE INDEX "FinanceEntry_refOrderId_idx" ON "FinanceEntry"("refOrderId");

-- CreateIndex
CREATE INDEX "DriverPayout_driverId_idx" ON "DriverPayout"("driverId");

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverPayout" ADD CONSTRAINT "DriverPayout_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverPayout" ADD CONSTRAINT "DriverPayout_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "DriverPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;
