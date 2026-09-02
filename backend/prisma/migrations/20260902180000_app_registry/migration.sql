-- APP REGISTRY (Платформын app каталог) — Odoo маягийн олон системийн
-- суурь. Application = глобал каталог, OrganizationApp = байгууллага
-- бүрийн идэвхжүүлсэн app-ууд. ursGAL нь каталогийн эхний ACTIVE app,
-- бусад нь COMING_SOON placeholder. Одоо байгаа бүх байгууллагад
-- "ursgal" автоматаар идэвхжинэ.

CREATE TYPE "AppStatus" AS ENUM ('ACTIVE', 'COMING_SOON', 'DISABLED');

CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameMn" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "descriptionMn" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "status" "AppStatus" NOT NULL DEFAULT 'COMING_SOON',
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationApp" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enabledByUserId" TEXT,

    CONSTRAINT "OrganizationApp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Application_key_key" ON "Application"("key");
CREATE UNIQUE INDEX "OrganizationApp_organizationId_applicationId_key" ON "OrganizationApp"("organizationId", "applicationId");

ALTER TABLE "OrganizationApp" ADD CONSTRAINT "OrganizationApp_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationApp" ADD CONSTRAINT "OrganizationApp_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationApp" ADD CONSTRAINT "OrganizationApp_enabledByUserId_fkey" FOREIGN KEY ("enabledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Каталогийн seed — id-ууд ТОГТМОЛ UUID (seed.ts мөн эдгээрийг хэрэглэнэ)
INSERT INTO "Application"("id", "key", "nameMn", "nameEn", "descriptionMn", "icon", "color", "status", "sortOrder", "updatedAt") VALUES
  ('00000000-0000-4000-8000-0000000a0001', 'ursgal', 'Урсгал', 'Ursgal',
   'Агуулах, захиалга, хүргэлт, санхүүгийн дотоод удирдлага',
   'boxes', '#8b2635', 'ACTIVE', 1, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-0000000a0002', 'sankhuu', 'Санхүү / НЯБО', 'Finance',
   'Дансны төлөвлөгөө, давхар бичилт, авлага/өглөг, НӨАТ, нэхэмжлэх',
   'landmark', '#1e6091', 'COMING_SOON', 2, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-0000000a0003', 'hr', 'Хүний нөөц / Цалин', 'HR & Payroll',
   'Ажилтны бүртгэл, ирц, амралт чөлөө, цалингийн тооцоо',
   'users', '#2d6a4f', 'COMING_SOON', 3, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-0000000a0004', 'crm', 'Харилцагч (CRM)', 'CRM',
   'Харилцагчийн бүртгэл, борлуулалтын сувгууд, идэвхжүүлэлт',
   'heart-handshake', '#7b2cbf', 'COMING_SOON', 4, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-0000000a0005', 'hudaldan-avalt', 'Худалдан авалт', 'Procurement',
   'Нийлүүлэгчийн үнийн санал, худалдан авалтын захиалга, өглөгийн хяналт',
   'shopping-cart', '#b5651d', 'COMING_SOON', 5, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-0000000a0006', 'tailan', 'Тайлан / Аналитик', 'Reports',
   'Нэгдсэн тайлан, KPI самбар, экспорт',
   'bar-chart-3', '#457b9d', 'COMING_SOON', 6, CURRENT_TIMESTAMP);

-- Одоо байгаа БҮХ байгууллагад ursgal-ийг идэвхжүүлнэ
INSERT INTO "OrganizationApp"("id", "organizationId", "applicationId")
SELECT gen_random_uuid(), o."id", '00000000-0000-4000-8000-0000000a0001'
FROM "Organization" o;
