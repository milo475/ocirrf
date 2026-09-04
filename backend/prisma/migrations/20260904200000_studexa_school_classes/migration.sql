-- Studexa (app 11) НЭГДСЭН АНГИ: сургуулийн анги (StudexaSchoolClass, олон багш хуваалцана),
-- ангийн багш (StudexaClassTeacher), сурагчийн мастер бүртгэл (StudexaPupil) + StudexaStudent.pupilId.
-- Багш бүрийн roster мөр ангиас автоматаар үүснэ; хуучин өгөгдөлд хүрэхгүй.
-- AlterTable
ALTER TABLE "StudexaStudent" ADD COLUMN     "pupilId" TEXT;

-- CreateTable
CREATE TABLE "StudexaSchoolClass" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "grade" INTEGER,
    "homeroomTeacherId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudexaSchoolClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudexaClassTeacher" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "subjectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudexaClassTeacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudexaPupil" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "classId" TEXT,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "registerNo" TEXT NOT NULL DEFAULT '',
    "birthDate" TEXT,
    "gender" "StudexaGender",
    "address" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "fatherName" TEXT NOT NULL DEFAULT '',
    "fatherPhone" TEXT NOT NULL DEFAULT '',
    "motherName" TEXT NOT NULL DEFAULT '',
    "motherPhone" TEXT NOT NULL DEFAULT '',
    "status" "StudexaStudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "enrolled" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudexaPupil_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudexaSchoolClass_organizationId_name_key" ON "StudexaSchoolClass"("organizationId", "name");

-- CreateIndex
CREATE INDEX "StudexaClassTeacher_organizationId_teacherId_idx" ON "StudexaClassTeacher"("organizationId", "teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "StudexaClassTeacher_organizationId_classId_teacherId_key" ON "StudexaClassTeacher"("organizationId", "classId", "teacherId");

-- CreateIndex
CREATE INDEX "StudexaPupil_organizationId_classId_name_idx" ON "StudexaPupil"("organizationId", "classId", "name");

-- CreateIndex
CREATE INDEX "StudexaPupil_userId_idx" ON "StudexaPupil"("userId");

-- CreateIndex
CREATE INDEX "StudexaStudent_pupilId_idx" ON "StudexaStudent"("pupilId");

-- AddForeignKey
ALTER TABLE "StudexaStudent" ADD CONSTRAINT "StudexaStudent_pupilId_fkey" FOREIGN KEY ("pupilId") REFERENCES "StudexaPupil"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaSchoolClass" ADD CONSTRAINT "StudexaSchoolClass_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaSchoolClass" ADD CONSTRAINT "StudexaSchoolClass_homeroomTeacherId_fkey" FOREIGN KEY ("homeroomTeacherId") REFERENCES "StudexaTeacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaClassTeacher" ADD CONSTRAINT "StudexaClassTeacher_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaClassTeacher" ADD CONSTRAINT "StudexaClassTeacher_classId_fkey" FOREIGN KEY ("classId") REFERENCES "StudexaSchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaClassTeacher" ADD CONSTRAINT "StudexaClassTeacher_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "StudexaTeacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaClassTeacher" ADD CONSTRAINT "StudexaClassTeacher_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "StudexaSubject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaPupil" ADD CONSTRAINT "StudexaPupil_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaPupil" ADD CONSTRAINT "StudexaPupil_classId_fkey" FOREIGN KEY ("classId") REFERENCES "StudexaSchoolClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudexaPupil" ADD CONSTRAINT "StudexaPupil_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

