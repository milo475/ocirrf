-- Studexa (app 11) сургуулийн нэмэлтүүд: хичээл (subject), улирал (term), үнэлгээний хуваарь, сурагчийн
-- профайл/төлөв/тэмдэглэл, төлбөрийн он, хичээлийн сэдвийн журнал. Payment.year нь одоо байгаа
-- мөрүүдэд энэ оноор бөглөгдөнө (dbgenerated default).
-- CreateEnum
CREATE TYPE "StudexaGender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "StudexaStudentStatus" AS ENUM ('ACTIVE', 'GRADUATED', 'LEFT');

-- DropIndex
DROP INDEX "StudexaPayment_organizationId_studentId_month_key";

-- AlterTable
ALTER TABLE "StudexaGradeColumn" ADD COLUMN     "subjectId" TEXT,
ADD COLUMN     "termId" TEXT;

-- AlterTable
ALTER TABLE "StudexaLesson" ADD COLUMN     "subjectId" TEXT;

-- AlterTable
ALTER TABLE "StudexaPayment" ADD COLUMN     "year" INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::int;

-- AlterTable
ALTER TABLE "StudexaStudent" ADD COLUMN     "address" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "birthDate" TEXT,
ADD COLUMN     "gender" "StudexaGender",
ADD COLUMN     "registerNo" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "status" "StudexaStudentStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "StudexaTeacher" ADD COLUMN     "gradingScale" JSONB;

-- CreateTable
CREATE TABLE "StudexaStudentNote" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudexaStudentNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudexaSubject" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'indigo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudexaSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudexaTerm" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudexaTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudexaLessonEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudexaLessonEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudexaStudentNote_organizationId_studentId_createdAt_idx" ON "StudexaStudentNote"("organizationId", "studentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudexaSubject_organizationId_teacherId_name_key" ON "StudexaSubject"("organizationId", "teacherId", "name");

-- CreateIndex
CREATE INDEX "StudexaTerm_organizationId_teacherId_startDate_idx" ON "StudexaTerm"("organizationId", "teacherId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "StudexaLessonEntry_organizationId_lessonId_date_key" ON "StudexaLessonEntry"("organizationId", "lessonId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "StudexaPayment_organizationId_studentId_year_month_key" ON "StudexaPayment"("organizationId", "studentId", "year", "month");

-- AddForeignKey
ALTER TABLE "StudexaStudentNote" ADD CONSTRAINT "StudexaStudentNote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaStudentNote" ADD CONSTRAINT "StudexaStudentNote_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudexaStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaSubject" ADD CONSTRAINT "StudexaSubject_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaSubject" ADD CONSTRAINT "StudexaSubject_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "StudexaTeacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaTerm" ADD CONSTRAINT "StudexaTerm_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaTerm" ADD CONSTRAINT "StudexaTerm_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "StudexaTeacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaLessonEntry" ADD CONSTRAINT "StudexaLessonEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaLessonEntry" ADD CONSTRAINT "StudexaLessonEntry_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "StudexaTeacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaLessonEntry" ADD CONSTRAINT "StudexaLessonEntry_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "StudexaLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaLesson" ADD CONSTRAINT "StudexaLesson_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "StudexaSubject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaGradeColumn" ADD CONSTRAINT "StudexaGradeColumn_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "StudexaSubject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaGradeColumn" ADD CONSTRAINT "StudexaGradeColumn_termId_fkey" FOREIGN KEY ("termId") REFERENCES "StudexaTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

