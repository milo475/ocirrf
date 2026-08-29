-- Харилцагч компани + жолоочийн харьяалах бүс (V5)
CREATE TABLE "Company" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "note" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");

ALTER TABLE "User" ADD COLUMN "companyId" TEXT;
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Product" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Product" ADD CONSTRAINT "Product_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DriverProfile" ADD COLUMN "zones" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
