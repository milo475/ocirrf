-- CreateEnum
CREATE TYPE "DeliveryRegion" AS ENUM ('ULAANBAATAR', 'ORON_NUTAG');

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "address",
ADD COLUMN     "addressDetail" TEXT,
ADD COLUMN     "building" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "door" TEXT,
ADD COLUMN     "entrance" TEXT,
ADD COLUMN     "extraPhone" TEXT,
ADD COLUMN     "floor" TEXT,
ADD COLUMN     "khoroo" TEXT,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "region" "DeliveryRegion" NOT NULL DEFAULT 'ULAANBAATAR',
ADD COLUMN     "soum" TEXT,
ADD COLUMN     "transport" TEXT,
ALTER COLUMN "customerName" DROP NOT NULL;

