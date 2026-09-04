import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { OrgContext } from '../org/org-context';
import { PrismaService } from '../prisma/prisma.service';
import { LessonDto } from './dto/studexa.dto';
import {
  buildScheduleGrid,
  buildScheduleSvg,
  DAY_END,
  DAY_START,
  recalcAttendance,
  teacherGroups,
  WEEKDAYS,
} from './studexa.util';
import type { TeacherCtx } from './teacher.service';

/** ХИЧЭЭЛИЙН ХУВААРЬ — 7 хоног × 07:00–23:00 тор */
@Injectable()
export class StudexaScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async grid(teacher: TeacherCtx, group: string | null) {
    const [g, groups] = await Promise.all([
      buildScheduleGrid(this.prisma, teacher.id, group),
      teacherGroups(this.prisma, teacher.id, { lessons: true }),
    ]);
    return {
      ...g,
      group: group ?? '',
      groups,
      dayStart: DAY_START,
      dayEnd: DAY_END,
    };
  }

  /**
   * ХУВААРИЙН ЗӨРЧИЛ: ижил гараг, цаг давхцсан, бүлэг нь огтлолцсон
   * (аль нэг нь «бүх бүлэг» эсвэл ижил бүлэг) хичээл байвал 400.
   */
  private async assertNoConflict(
    teacher: TeacherCtx,
    dto: LessonDto,
    group: string,
    excludeId?: string,
  ) {
    const same = await this.prisma.studexaLesson.findMany({
      where: {
        teacherId: teacher.id,
        weekday: dto.weekday,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    const clash = same.find(
      (l) =>
        l.startTime < dto.endTime &&
        l.endTime > dto.startTime &&
        (l.group === '' || group === '' || l.group === group),
    );
    if (clash) {
      throw new BadRequestException(
        `Хуваарийн зөрчил: ${clash.title}${clash.group ? ` (${clash.group})` : ' (бүх бүлэг)'} ${clash.startTime}–${clash.endTime} энэ цагтай давхцаж байна`,
      );
    }
  }

  private async subjectFor(
    teacher: TeacherCtx,
    raw: string | undefined,
  ): Promise<string | null> {
    const id = (raw ?? '').trim();
    if (!id) return null;
    const s = await this.prisma.studexaSubject.findFirst({
      where: { id, teacherId: teacher.id },
      select: { id: true },
    });
    if (!s) throw new BadRequestException('Хичээл (судлагдахуун) олдсонгүй');
    return s.id;
  }

  private validate(dto: LessonDto) {
    if (dto.endTime <= dto.startTime) {
      throw new BadRequestException('Дуусах цаг эхлэх цагаас хойш байх ёстой');
    }
    if (
      dto.startTime < `${String(DAY_START).padStart(2, '0')}:00` ||
      dto.endTime > `${DAY_END}:00`
    ) {
      throw new BadRequestException(
        `Хичээлийн цаг ${String(DAY_START).padStart(2, '0')}:00–${DAY_END}:00 хооронд байх ёстой`,
      );
    }
  }

  private async notifyGroup(
    teacher: TeacherCtx,
    group: string,
    title: string,
    lessonId: string,
  ) {
    const students = await this.prisma.studexaStudent.findMany({
      where: {
        teacherId: teacher.id,
        userId: { not: null },
        ...(group ? { group } : {}),
      },
      select: { userId: true },
    });
    const ids = students.map((s) => s.userId!).filter(Boolean);
    if (ids.length) {
      await this.notifications.notify(ids, {
        type: 'STUDEXA_SCHEDULE',
        title,
        refType: 'studexa',
        refId: lessonId,
      });
    }
  }

  private label(l: { title: string; weekday: number; startTime: string }) {
    return `${l.title} — ${WEEKDAYS[l.weekday]} ${l.startTime}`;
  }

  async create(teacher: TeacherCtx, dto: LessonDto) {
    this.validate(dto);
    const group = (dto.group ?? '').trim();
    await this.assertNoConflict(teacher, dto, group);
    const subjectId = await this.subjectFor(teacher, dto.subjectId);
    const lesson = await this.prisma.studexaLesson.create({
      data: {
        organizationId: OrgContext.require(),
        teacherId: teacher.id,
        title: dto.title.trim(),
        group,
        weekday: dto.weekday,
        startTime: dto.startTime,
        endTime: dto.endTime,
        color: dto.color ?? 'indigo',
        subjectId,
      },
    });
    await this.notifyGroup(
      teacher,
      group,
      `🗓 Шинэ хичээл нэмэгдлээ: ${this.label(lesson)}`,
      lesson.id,
    );
    return lesson;
  }

  async get(teacher: TeacherCtx, id: string) {
    const l = await this.prisma.studexaLesson.findFirst({
      where: { id, teacherId: teacher.id },
      include: { subject: { select: { id: true, name: true } } },
    });
    if (!l) throw new NotFoundException('Хичээл олдсонгүй');
    return l;
  }

  async update(teacher: TeacherCtx, id: string, dto: LessonDto) {
    await this.get(teacher, id);
    this.validate(dto);
    const group = (dto.group ?? '').trim();
    await this.assertNoConflict(teacher, dto, group, id);
    const subjectId = await this.subjectFor(teacher, dto.subjectId);
    const lesson = await this.prisma.studexaLesson.update({
      where: { id },
      data: {
        title: dto.title.trim(),
        group,
        weekday: dto.weekday,
        startTime: dto.startTime,
        endTime: dto.endTime,
        color: dto.color ?? 'indigo',
        subjectId,
      },
    });
    await this.notifyGroup(
      teacher,
      group,
      `🗓 Хичээлийн хуваарь өөрчлөгдлөө: ${this.label(lesson)}`,
      lesson.id,
    );
    return lesson;
  }

  /**
   * Хичээл устгах. Түүний ирцийн бүртгэл өдрийн ерөнхий ирц болно; тухайн
   * өдөр аль хэдийн ерөнхий бүртгэлтэй бол давхардуулахгүй устгана,
   * сурагчдын ирцийн хувийг дахин тооцно.
   */
  async remove(teacher: TeacherCtx, id: string) {
    const lesson = await this.get(teacher, id);
    const atts = await this.prisma.studexaAttendanceRecord.findMany({
      where: { lessonId: id },
    });
    const studentIds = [...new Set(atts.map((a) => a.studentId))];
    if (atts.length) {
      const general = new Set(
        (
          await this.prisma.studexaAttendanceRecord.findMany({
            where: { studentId: { in: studentIds }, lessonKey: '' },
            select: { studentId: true, date: true },
          })
        ).map((g) => `${g.studentId}|${g.date}`),
      );
      for (const a of atts) {
        const key = `${a.studentId}|${a.date}`;
        if (general.has(key)) {
          await this.prisma.studexaAttendanceRecord.delete({
            where: { id: a.id },
          });
        } else {
          await this.prisma.studexaAttendanceRecord.update({
            where: { id: a.id },
            data: { lessonId: null, lessonKey: '' },
          });
          general.add(key);
        }
      }
    }
    await this.notifyGroup(
      teacher,
      lesson.group,
      `🗓 Хичээл хасагдлаа: ${this.label(lesson)}`,
      lesson.id,
    );
    await this.prisma.studexaLesson.delete({ where: { id } });
    for (const sid of studentIds) await recalcAttendance(this.prisma, sid);
    return { ok: true };
  }

  async svg(
    teacherId: string,
    group: string | null,
    title: string,
  ): Promise<string> {
    const grid = await buildScheduleGrid(this.prisma, teacherId, group);
    return buildScheduleSvg(grid, title);
  }
}
