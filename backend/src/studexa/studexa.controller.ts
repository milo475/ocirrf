import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { PERM } from '../permissions/permission-keys';
import { RequirePermission } from '../permissions/require-permission.decorator';
import { NotificationsService } from '../notifications/notifications.service';
import { OrgContext } from '../org/org-context';
import { PrismaService } from '../prisma/prisma.service';
import { StudexaAttendanceService } from './attendance.service';
import {
  AnnouncementDto,
  AssessmentAddDto,
  AttendanceQueryDto,
  AttendanceSaveDto,
  ColumnCreateDto,
  GradebookSaveDto,
  GroupAddDto,
  GroupNameDto,
  HomeworkCreateDto,
  HomeworkGradeDto,
  HomeworkQueryDto,
  HomeworkStatusDto,
  JoinApproveDto,
  LessonDto,
  NoteDto,
  PaymentSetDto,
  QueryStudentsDto,
  SetupTeacherDto,
  StudentDto,
  UpdateTeacherDto,
} from './dto/studexa.dto';
import { StudexaGradebookService } from './gradebook.service';
import { StudexaHomeworkService } from './homework.service';
import { StudexaScheduleService } from './schedule.service';
import { StudexaStudentsService } from './students.service';
import {
  STUDEXA_MAX_FILE_BYTES,
  studexaFileFilter,
  studexaStorage,
} from './studexa-files';
import { clip, contentDisposition, teacherGroups } from './studexa.util';
import { StudexaTeacherService } from './teacher.service';

/**
 * STUDEXA — БАГШИЙН ТАЛ. Бүх endpoint studexa.teach эрх шаардана; багшийн
 * профайлгүй бол 412 (frontend → тохиргооны дэлгэц). Өгөгдөл бүр
 * байгууллага (org-scope) + багш (teacherId) хоёр давхар шүүлттэй.
 */
@Controller('studexa')
@RequirePermission(PERM.STUDEXA_TEACH)
export class StudexaController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teachers: StudexaTeacherService,
    private readonly students: StudexaStudentsService,
    private readonly gradebook: StudexaGradebookService,
    private readonly attendance: StudexaAttendanceService,
    private readonly schedule: StudexaScheduleService,
    private readonly homework: StudexaHomeworkService,
    private readonly notifications: NotificationsService,
  ) {}

  // ───────────────────────────── Профайл, самбар

  @Post('teacher')
  setup(@CurrentUser() user: AuthUser, @Body() dto: SetupTeacherDto) {
    return this.teachers.setup(user, dto);
  }

  @Patch('teacher')
  async updateTeacher(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateTeacherDto,
  ) {
    return this.teachers.update(await this.teachers.require(user), dto);
  }

  @Get('dashboard')
  async dashboard(@CurrentUser() user: AuthUser) {
    return this.teachers.dashboard(await this.teachers.require(user));
  }

  // ───────────────────────────── Сурагчид

  @Get('students')
  async listStudents(
    @CurrentUser() user: AuthUser,
    @Query() q: QueryStudentsDto,
  ) {
    return this.students.list(await this.teachers.require(user), q);
  }

  @Get('class-table')
  async classTable(
    @CurrentUser() user: AuthUser,
    @Query('group') group?: string,
  ) {
    return this.students.classTable(
      await this.teachers.require(user),
      group || undefined,
    );
  }

  @Post('students')
  async createStudent(@CurrentUser() user: AuthUser, @Body() dto: StudentDto) {
    return this.students.create(await this.teachers.require(user), dto);
  }

  @Get('students/:id')
  async getStudent(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.students.get(await this.teachers.require(user), id);
  }

  @Patch('students/:id')
  async updateStudent(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StudentDto,
  ) {
    return this.students.update(await this.teachers.require(user), id, dto);
  }

  @Delete('students/:id')
  async deleteStudent(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.students.remove(await this.teachers.require(user), id);
  }

  @Post('students/:id/unlink')
  async unlink(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.students.unlink(
      await this.teachers.require(user),
      id,
      user.name,
    );
  }

  @Post('students/:id/payments')
  async setPayment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PaymentSetDto,
  ) {
    return this.students.setPayment(await this.teachers.require(user), id, dto);
  }

  @Delete('students/:id/payments/:month')
  async deletePayment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('month', ParseIntPipe) month: number,
  ) {
    return this.students.deletePayment(
      await this.teachers.require(user),
      id,
      month,
    );
  }

  @Post('students/:id/assessments')
  async addAssessment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssessmentAddDto,
  ) {
    return this.students.addAssessment(
      await this.teachers.require(user),
      id,
      dto,
    );
  }

  // ───────────────────────────── Бүлэг

  @Get('groups')
  async groups(@CurrentUser() user: AuthUser) {
    const teacher = await this.teachers.require(user);
    const [cards, names] = await Promise.all([
      this.students.groupCards(teacher),
      teacherGroups(this.prisma, teacher.id, { lessons: true }),
    ]);
    return { cards, names };
  }

  @Post('groups')
  async createGroup(@CurrentUser() user: AuthUser, @Body() dto: GroupNameDto) {
    return this.students.createGroup(
      await this.teachers.require(user),
      dto.name,
    );
  }

  @Get('groups/:name')
  async groupDetail(
    @CurrentUser() user: AuthUser,
    @Param('name') name: string,
  ) {
    return this.students.groupDetail(await this.teachers.require(user), name);
  }

  @Post('groups/:name/add')
  async groupAdd(
    @CurrentUser() user: AuthUser,
    @Param('name') name: string,
    @Body() dto: GroupAddDto,
  ) {
    return this.students.addToGroup(
      await this.teachers.require(user),
      name,
      dto,
    );
  }

  @Post('groups/:name/remove/:studentId')
  async groupRemove(
    @CurrentUser() user: AuthUser,
    @Param('name') name: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.students.removeFromGroup(
      await this.teachers.require(user),
      name,
      studentId,
    );
  }

  @Delete('groups/:name')
  async groupDissolve(
    @CurrentUser() user: AuthUser,
    @Param('name') name: string,
  ) {
    return this.students.dissolveGroup(await this.teachers.require(user), name);
  }

  // ───────────────────────────── Элсэх хүсэлт

  @Get('join-requests')
  async joinRequests(@CurrentUser() user: AuthUser) {
    return this.students.joinRequests(await this.teachers.require(user));
  }

  @Post('join-requests/:id/approve')
  async approveJoin(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: JoinApproveDto,
  ) {
    return this.students.approveJoin(
      await this.teachers.require(user),
      id,
      dto,
    );
  }

  @Post('join-requests/:id/reject')
  async rejectJoin(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.students.rejectJoin(await this.teachers.require(user), id);
  }

  // ───────────────────────────── Ирц

  @Get('attendance')
  async attendancePage(
    @CurrentUser() user: AuthUser,
    @Query() q: AttendanceQueryDto,
  ) {
    return this.attendance.page(await this.teachers.require(user), q);
  }

  @Post('attendance')
  async attendanceSave(
    @CurrentUser() user: AuthUser,
    @Body() dto: AttendanceSaveDto,
  ) {
    return this.attendance.save(await this.teachers.require(user), dto);
  }

  // ───────────────────────────── Дүнгийн нэгтгэл

  @Get('gradebook')
  async gradebookGet(
    @CurrentUser() user: AuthUser,
    @Query('group') group?: string,
  ) {
    return this.gradebook.get(
      await this.teachers.require(user),
      group || undefined,
    );
  }

  @Post('gradebook')
  async gradebookSave(
    @CurrentUser() user: AuthUser,
    @Query('group') group: string | undefined,
    @Body() dto: GradebookSaveDto,
  ) {
    return this.gradebook.save(
      await this.teachers.require(user),
      group || undefined,
      dto,
    );
  }

  @Post('gradebook/columns')
  async createColumn(
    @CurrentUser() user: AuthUser,
    @Body() dto: ColumnCreateDto,
  ) {
    return this.gradebook.createColumn(await this.teachers.require(user), dto);
  }

  @Delete('gradebook/columns/:id')
  async deleteColumn(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.gradebook.deleteColumn(await this.teachers.require(user), id);
  }

  // ───────────────────────────── Хуваарь

  @Get('schedule')
  async scheduleGrid(
    @CurrentUser() user: AuthUser,
    @Query('group') group?: string,
  ) {
    return this.schedule.grid(
      await this.teachers.require(user),
      group ? group : null,
    );
  }

  @Post('lessons')
  async createLesson(@CurrentUser() user: AuthUser, @Body() dto: LessonDto) {
    return this.schedule.create(await this.teachers.require(user), dto);
  }

  @Get('lessons/:id')
  async getLesson(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.schedule.get(await this.teachers.require(user), id);
  }

  @Patch('lessons/:id')
  async updateLesson(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LessonDto,
  ) {
    return this.schedule.update(await this.teachers.require(user), id, dto);
  }

  @Delete('lessons/:id')
  async deleteLesson(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.schedule.remove(await this.teachers.require(user), id);
  }

  // ───────────────────────────── Даалгавар

  @Get('homework')
  async homeworkList(
    @CurrentUser() user: AuthUser,
    @Query() q: HomeworkQueryDto,
  ) {
    return this.homework.list(await this.teachers.require(user), q);
  }

  @Post('homework')
  @UseInterceptors(
    FileInterceptor('attachment', {
      storage: studexaStorage,
      limits: { fileSize: STUDEXA_MAX_FILE_BYTES },
      fileFilter: studexaFileFilter,
    }),
  )
  async homeworkCreate(
    @CurrentUser() user: AuthUser,
    @Body() dto: HomeworkCreateDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.homework.create(await this.teachers.require(user), dto, file);
  }

  @Patch('homework/:id/status')
  async homeworkStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: HomeworkStatusDto,
  ) {
    return this.homework.setStatus(
      await this.teachers.require(user),
      id,
      dto.status,
    );
  }

  @Post('homework/:id/grade')
  async homeworkGrade(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: HomeworkGradeDto,
  ) {
    return this.homework.grade(await this.teachers.require(user), id, dto);
  }

  @Delete('homework/:id')
  async homeworkDelete(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.homework.remove(await this.teachers.require(user), id);
  }

  // ───────────────────────────── Зарлал

  @Get('announcements')
  async announcements(@CurrentUser() user: AuthUser) {
    const teacher = await this.teachers.require(user);
    const [items, groups] = await Promise.all([
      this.prisma.studexaAnnouncement.findMany({
        where: { teacherId: teacher.id },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      teacherGroups(this.prisma, teacher.id),
    ]);
    return { items, groups };
  }

  @Post('announcements')
  async createAnnouncement(
    @CurrentUser() user: AuthUser,
    @Body() dto: AnnouncementDto,
  ) {
    const teacher = await this.teachers.require(user);
    const group = clip((dto.group ?? '').trim(), 100);
    const ann = await this.prisma.studexaAnnouncement.create({
      data: {
        organizationId: OrgContext.require(),
        teacherId: teacher.id,
        group,
        text: dto.text.trim(),
      },
    });
    const targets = await this.prisma.studexaStudent.findMany({
      where: {
        teacherId: teacher.id,
        userId: { not: null },
        ...(group ? { group } : {}),
      },
      select: { userId: true },
    });
    const ids = targets.map((t) => t.userId!).filter(Boolean);
    if (ids.length) {
      await this.notifications.notify(ids, {
        type: 'STUDEXA_ANNOUNCEMENT',
        title: clip(
          `📢 Шинэ зарлал: ${dto.text.trim().split('\n')[0].slice(0, 60)}`,
          200,
        ),
        refType: 'studexa',
        refId: ann.id,
      });
    }
    return ann;
  }

  @Delete('announcements/:id')
  async deleteAnnouncement(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const teacher = await this.teachers.require(user);
    await this.prisma.studexaAnnouncement.deleteMany({
      where: { id, teacherId: teacher.id },
    });
    return { ok: true };
  }

  // ───────────────────────────── Тэмдэглэл

  @Get('notes')
  async notes(@CurrentUser() user: AuthUser) {
    const teacher = await this.teachers.require(user);
    return this.prisma.studexaNote.findMany({
      where: { teacherId: teacher.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  @Post('notes')
  async createNote(@CurrentUser() user: AuthUser, @Body() dto: NoteDto) {
    const teacher = await this.teachers.require(user);
    return this.prisma.studexaNote.create({
      data: {
        organizationId: OrgContext.require(),
        teacherId: teacher.id,
        title: dto.title.trim(),
        text: dto.text.trim(),
      },
    });
  }

  @Patch('notes/:id')
  async updateNote(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: NoteDto,
  ) {
    const teacher = await this.teachers.require(user);
    const res = await this.prisma.studexaNote.updateMany({
      where: { id, teacherId: teacher.id },
      data: { title: dto.title.trim(), text: dto.text.trim() },
    });
    return { ok: res.count > 0 };
  }

  @Delete('notes/:id')
  async deleteNote(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const teacher = await this.teachers.require(user);
    await this.prisma.studexaNote.deleteMany({
      where: { id, teacherId: teacher.id },
    });
    return { ok: true };
  }

  // ───────────────────────────── Экспорт (CSV / SVG)

  @Get('export/gradebook.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportGradebook(
    @CurrentUser() user: AuthUser,
    @Query('group') group: string | undefined,
    @Res() res: Response,
  ) {
    const csv = await this.gradebook.exportCsv(
      await this.teachers.require(user),
      group || undefined,
    );
    res.setHeader('Content-Disposition', contentDisposition('negtgel.csv'));
    res.send(csv);
  }

  @Get('export/attendance.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportAttendance(
    @CurrentUser() user: AuthUser,
    @Query('group') group: string | undefined,
    @Res() res: Response,
  ) {
    const csv = await this.attendance.exportCsv(
      await this.teachers.require(user),
      group || undefined,
    );
    res.setHeader('Content-Disposition', contentDisposition('irts.csv'));
    res.send(csv);
  }

  @Get('export/schedule.svg')
  @Header('Content-Type', 'image/svg+xml; charset=utf-8')
  async exportSchedule(
    @CurrentUser() user: AuthUser,
    @Query('group') group: string | undefined,
    @Res() res: Response,
  ) {
    const teacher = await this.teachers.require(user);
    const svg = await this.schedule.svg(
      teacher.id,
      group || null,
      `Хичээлийн хуваарь${group ? ` — ${group}` : ''}`,
    );
    res.setHeader('Content-Disposition', contentDisposition('huvaari.svg'));
    res.send(svg);
  }
}
