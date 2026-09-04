import { Module } from '@nestjs/common';
import { StudexaAcademicsService } from './academics.service';
import { StudexaAttendanceService } from './attendance.service';
import { StudexaGradebookService } from './gradebook.service';
import { StudexaHomeworkService } from './homework.service';
import { StudexaPortalService } from './portal.service';
import { StudexaScheduleService } from './schedule.service';
import { StudexaStudentsService } from './students.service';
import { StudexaFilesController } from './studexa-files.controller';
import { StudexaPortalController } from './studexa-portal.controller';
import { StudexaPublicController } from './studexa-public.controller';
import { StudexaController } from './studexa.controller';
import { StudexaTeacherService } from './teacher.service';

/**
 * STUDEXA (app 11) — багшийн систем. Django Studexa-г платформын модулийн
 * стандартаар шилжүүлсэн: өөрийн Prisma model-ууд (org-scoped), permission
 * түлхүүрүүд (studexa.teach / studexa.portal), frontend манифест
 * (frontend/src/apps/studexa). Бусад app-ийн дотоод service-д хүрэхгүй;
 * платформын дундын дэд бүтэц (Prisma, OrgContext, Permissions,
 * Notifications, uploads util)-ийг л ашиглана.
 */
@Module({
  controllers: [
    StudexaController,
    StudexaPortalController,
    StudexaPublicController,
    StudexaFilesController,
  ],
  providers: [
    StudexaTeacherService,
    StudexaAcademicsService,
    StudexaStudentsService,
    StudexaGradebookService,
    StudexaAttendanceService,
    StudexaScheduleService,
    StudexaHomeworkService,
    StudexaPortalService,
  ],
  exports: [StudexaTeacherService],
})
export class StudexaModule {}
