-- Порталын хэрэглэгч (CUSTOMER эрх), тарифын систем, хүргэлтийн хөлсийг хасав.
-- Захиалга зөвхөн ажилтнаар шивэгдэнэ (IG/FB DM-ээс).

-- 1. Захиалгын порталын холбоос ба хүргэлтийн хөлс
ALTER TABLE "Order" DROP COLUMN IF EXISTS "customerId";
ALTER TABLE "Order" DROP COLUMN IF EXISTS "deliveryFee";

-- 2. Тарифын хүснэгт
DROP TABLE IF EXISTS "DeliveryTariff";

-- 3. Role enum-оос CUSTOMER-ыг хасна (Postgres-д төрлийг дахин үүсгэнэ)
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'OPERATOR', 'DRIVER');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'OPERATOR';
DROP TYPE "Role_old";

-- 4. Порталын тохиргоо
DELETE FROM "Setting" WHERE "key" = 'allowCustomerCancel';
