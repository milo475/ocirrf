-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "costAtOrder" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "costPrice" DECIMAL(12,2) NOT NULL DEFAULT 0;
