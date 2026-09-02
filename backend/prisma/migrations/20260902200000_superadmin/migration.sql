-- SUPERADMIN (платформын түвшний эрх) — байгууллага доторх role-уудаас
-- ТУСДАА дээд давхарга. scripts/make-superadmin.ts-ээр олгоно.
ALTER TABLE "User" ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;
