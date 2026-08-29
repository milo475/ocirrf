-- Жолоочийн ажлын төрөл: үндсэн эсвэл цагийн (V5)
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'HOURLY');
ALTER TABLE "DriverProfile" ADD COLUMN "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME';
