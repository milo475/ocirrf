-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryFee" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DeliveryTariff" (
    "id" TEXT NOT NULL,
    "region" "DeliveryRegion" NOT NULL,
    "district" TEXT,
    "fee" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "DeliveryTariff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryTariff_region_district_key" ON "DeliveryTariff"("region", "district");
