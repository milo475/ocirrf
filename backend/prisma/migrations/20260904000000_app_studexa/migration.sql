-- CreateEnum
CREATE TYPE "StudexaSchoolType" AS ENUM ('UNIVERSITY', 'SCHOOL', 'ACADEMY', 'PRIVATE');

-- CreateEnum
CREATE TYPE "StudexaPayState" AS ENUM ('PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "StudexaMonthPayState" AS ENUM ('PAID', 'PENDING', 'OVERDUE');

-- CreateEnum
CREATE TYPE "StudexaAttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT');

-- CreateEnum
CREATE TYPE "StudexaHomeworkStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE');

-- CreateTable
CREATE TABLE "StudexaTeacher" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "schoolType" "StudexaSchoolType" NOT NULL DEFAULT 'SCHOOL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudexaTeacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudexaGroup" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "StudexaGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudexaStudent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "studentCode" TEXT NOT NULL DEFAULT '',
    "group" TEXT NOT NULL DEFAULT '',
    "attendance" INTEGER NOT NULL DEFAULT 100,
    "attendedLessons" INTEGER NOT NULL DEFAULT 0,
    "totalLessons" INTEGER NOT NULL DEFAULT 0,
    "paymentStatus" "StudexaPayState" NOT NULL DEFAULT 'PAID',
    "enrolled" TEXT NOT NULL,
    "hwPercent" INTEGER,
    "phone" TEXT NOT NULL DEFAULT '',
    "fatherName" TEXT NOT NULL DEFAULT '',
    "fatherPhone" TEXT NOT NULL DEFAULT '',
    "motherName" TEXT NOT NULL DEFAULT '',
    "motherPhone" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudexaStudent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudexaLesson" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "group" TEXT NOT NULL DEFAULT '',
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'indigo',

    CONSTRAINT "StudexaLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudexaAttendanceRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "lessonId" TEXT,
    "lessonKey" TEXT NOT NULL DEFAULT '',
    "status" "StudexaAttendanceStatus" NOT NULL,

    CONSTRAINT "StudexaAttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudexaGradeColumn" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxScore" INTEGER NOT NULL DEFAULT 100,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StudexaGradeColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudexaAssessment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "score" INTEGER NOT NULL,

    CONSTRAINT "StudexaAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudexaHomework" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "dueDate" TEXT,
    "title" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "link" TEXT NOT NULL DEFAULT '',
    "status" "StudexaHomeworkStatus" NOT NULL DEFAULT 'PENDING',
    "score" INTEGER,
    "gradeColumnId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudexaHomework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudexaSubmission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "homeworkId" TEXT NOT NULL,
    "fileUrl" TEXT,
    "link" TEXT NOT NULL DEFAULT '',
    "comment" TEXT NOT NULL DEFAULT '',
    "submittedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudexaSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudexaPayment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "StudexaMonthPayState" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "StudexaPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudexaJoinRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "studentCode" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "fatherName" TEXT NOT NULL DEFAULT '',
    "fatherPhone" TEXT NOT NULL DEFAULT '',
    "motherName" TEXT NOT NULL DEFAULT '',
    "motherPhone" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudexaJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudexaAnnouncement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "group" TEXT NOT NULL DEFAULT '',
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudexaAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudexaNote" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudexaNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudexaTeacher_userId_key" ON "StudexaTeacher"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StudexaTeacher_code_key" ON "StudexaTeacher"("code");

-- CreateIndex
CREATE INDEX "StudexaTeacher_organizationId_createdAt_idx" ON "StudexaTeacher"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudexaGroup_organizationId_teacherId_name_key" ON "StudexaGroup"("organizationId", "teacherId", "name");

-- CreateIndex
CREATE INDEX "StudexaStudent_organizationId_teacherId_name_idx" ON "StudexaStudent"("organizationId", "teacherId", "name");

-- CreateIndex
CREATE INDEX "StudexaStudent_userId_idx" ON "StudexaStudent"("userId");

-- CreateIndex
CREATE INDEX "StudexaLesson_organizationId_teacherId_weekday_startTime_idx" ON "StudexaLesson"("organizationId", "teacherId", "weekday", "startTime");

-- CreateIndex
CREATE INDEX "StudexaAttendanceRecord_organizationId_date_idx" ON "StudexaAttendanceRecord"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "StudexaAttendanceRecord_organizationId_studentId_date_lesso_key" ON "StudexaAttendanceRecord"("organizationId", "studentId", "date", "lessonKey");

-- CreateIndex
CREATE INDEX "StudexaGradeColumn_organizationId_teacherId_order_idx" ON "StudexaGradeColumn"("organizationId", "teacherId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "StudexaAssessment_organizationId_studentId_columnId_key" ON "StudexaAssessment"("organizationId", "studentId", "columnId");

-- CreateIndex
CREATE INDEX "StudexaHomework_organizationId_studentId_date_idx" ON "StudexaHomework"("organizationId", "studentId", "date");

-- CreateIndex
CREATE INDEX "StudexaHomework_organizationId_date_idx" ON "StudexaHomework"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "StudexaSubmission_homeworkId_key" ON "StudexaSubmission"("homeworkId");

-- CreateIndex
CREATE INDEX "StudexaSubmission_organizationId_submittedAt_idx" ON "StudexaSubmission"("organizationId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudexaPayment_organizationId_studentId_month_key" ON "StudexaPayment"("organizationId", "studentId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "StudexaJoinRequest_organizationId_userId_teacherId_key" ON "StudexaJoinRequest"("organizationId", "userId", "teacherId");

-- CreateIndex
CREATE INDEX "StudexaAnnouncement_organizationId_teacherId_createdAt_idx" ON "StudexaAnnouncement"("organizationId", "teacherId", "createdAt");

-- CreateIndex
CREATE INDEX "StudexaNote_organizationId_teacherId_createdAt_idx" ON "StudexaNote"("organizationId", "teacherId", "createdAt");

-- AddForeignKey
ALTER TABLE "StudexaTeacher" ADD CONSTRAINT "StudexaTeacher_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaTeacher" ADD CONSTRAINT "StudexaTeacher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaGroup" ADD CONSTRAINT "StudexaGroup_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaGroup" ADD CONSTRAINT "StudexaGroup_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "StudexaTeacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaStudent" ADD CONSTRAINT "StudexaStudent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaStudent" ADD CONSTRAINT "StudexaStudent_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "StudexaTeacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaStudent" ADD CONSTRAINT "StudexaStudent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaLesson" ADD CONSTRAINT "StudexaLesson_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaLesson" ADD CONSTRAINT "StudexaLesson_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "StudexaTeacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaAttendanceRecord" ADD CONSTRAINT "StudexaAttendanceRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaAttendanceRecord" ADD CONSTRAINT "StudexaAttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudexaStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaAttendanceRecord" ADD CONSTRAINT "StudexaAttendanceRecord_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "StudexaLesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaGradeColumn" ADD CONSTRAINT "StudexaGradeColumn_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaGradeColumn" ADD CONSTRAINT "StudexaGradeColumn_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "StudexaTeacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaAssessment" ADD CONSTRAINT "StudexaAssessment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaAssessment" ADD CONSTRAINT "StudexaAssessment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudexaStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaAssessment" ADD CONSTRAINT "StudexaAssessment_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "StudexaGradeColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaHomework" ADD CONSTRAINT "StudexaHomework_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaHomework" ADD CONSTRAINT "StudexaHomework_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudexaStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaHomework" ADD CONSTRAINT "StudexaHomework_gradeColumnId_fkey" FOREIGN KEY ("gradeColumnId") REFERENCES "StudexaGradeColumn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaSubmission" ADD CONSTRAINT "StudexaSubmission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaSubmission" ADD CONSTRAINT "StudexaSubmission_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "StudexaHomework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaPayment" ADD CONSTRAINT "StudexaPayment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaPayment" ADD CONSTRAINT "StudexaPayment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudexaStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaJoinRequest" ADD CONSTRAINT "StudexaJoinRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaJoinRequest" ADD CONSTRAINT "StudexaJoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaJoinRequest" ADD CONSTRAINT "StudexaJoinRequest_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "StudexaTeacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaAnnouncement" ADD CONSTRAINT "StudexaAnnouncement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaAnnouncement" ADD CONSTRAINT "StudexaAnnouncement_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "StudexaTeacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaNote" ADD CONSTRAINT "StudexaNote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaNote" ADD CONSTRAINT "StudexaNote_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "StudexaTeacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ═══ App Registry: Studexa = каталогийн 11 дэх систем (ACTIVE) ═══
-- Django Studexa (багшийн систем)-ийг платформ руу шилжүүлсэн. id/key ТОГТМОЛ
-- (seed.ts-ийн APP_CATALOG-тай ижил). Дахин ажиллуулахад аюулгүй.
INSERT INTO "Application"("id", "key", "nameMn", "nameEn", "descriptionMn", "icon", "color", "status", "sortOrder", "updatedAt") VALUES
  ('00000000-0000-4000-8000-0000000a0011', 'studexa', 'Studexa — Багшийн систем', 'Studexa',
   'Сурагчийн бүртгэл, ирц, дүнгийн нэгтгэл, хичээлийн хуваарь, даалгавар, зарлал, төлбөрийн хяналт',
   'graduation-cap', '#4f46e5', 'ACTIVE', 11, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- Default 'ocirrf' байгууллагад шууд идэвхжүүлнэ (бусад байгууллага launcher-аас идэвхжүүлнэ)
INSERT INTO "OrganizationApp"("id", "organizationId", "applicationId")
SELECT gen_random_uuid(), o."id", '00000000-0000-4000-8000-0000000a0011'
FROM "Organization" o
WHERE o."id" = '00000000-0000-4000-8000-000000000001'
ON CONFLICT ("organizationId", "applicationId") DO NOTHING;
