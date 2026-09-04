import { BadRequestException, Injectable } from '@nestjs/common';
import { StudexaAttendanceStatus } from '../generated/prisma/client';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrgContext } from '../org/org-context';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceQueryDto, AttendanceSaveDto } from './dto/studexa.dto';
import {
  buildCsv,
  clip,
  effectiveAttendances,
  recalcAttendance,
  teacherGroups,
  todayStr,
  weekdayOf,
} from './studexa.util';
import type { TeacherCtx } from './teacher.service';

/** ИРЦ БҮРТГЭЛ — өдөр + хичээл (заавал биш) + бүлэг сонгоод тэмдэглэнэ */
@Injectable()
export class StudexaAttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
  ) {}

  private async resolve(teacher: TeacherCtx, q: AttendanceQueryDto) {
    const day = q.date ?? todayStr();
    const lesson = q.lessonId
      ? await this.prisma.studexaLesson.findFirst({
          where: { id: q.lessonId, teacherId: teacher.id },
        })
      : null;
    const group = q.group ?? '';
    let students = await this.prisma.studexaStudent.findMany({
      where: {
        teacherId: teacher.id,
        status: 'ACTIVE',
        ...(group ? { group } : {}),
      },
      select: { id: true, name: true, group: true, userId: true },
      orderBy: [{ group: 'asc' }, { name: 'asc' }],
    });
    // Хичээл бүлэгтэй бол зөвхөн тэр бүлгийн сурагчид
    if (lesson?.group)
      students = students.filter((s) => s.group === lesson.group);
    return { day, lesson, group, students };
  }

  async page(teacher: TeacherCtx, q: AttendanceQueryDto) {
    const { day, lesson, group, students } = await this.resolve(teacher, q);
    const [existing, dayLessons, groups, entry] = await Promise.all([
      students.length
        ? this.prisma.studexaAttendanceRecord.findMany({
            where: {
              studentId: { in: students.map((s) => s.id) },
              date: day,
              lessonKey: lesson?.id ?? '',
            },
            select: { studentId: true, status: true },
          })
        : Promise.resolve(
            [] as { studentId: string; status: StudexaAttendanceStatus }[],
          ),
      this.prisma.studexaLesson.findMany({
        where: {
          teacherId: teacher.id,
          weekday: weekdayOf(day),
          ...(group ? { OR: [{ group: '' }, { group }] } : {}),
        },
        orderBy: { startTime: 'asc' },
      }),
      teacherGroups(this.prisma, teacher.id),
      lesson
        ? this.prisma.studexaLessonEntry.findFirst({
            where: { lessonId: lesson.id, date: day },
            select: { topic: true },
          })
        : Promise.resolve(null),
    ]);
    const statusBy = new Map(existing.map((e) => [e.studentId, e.status]));
    return {
      day,
      // Хичээлийн сэдэв (журнал) — тухайн хичээл, тухайн өдөр
      topic: entry?.topic ?? '',
      lesson: lesson
        ? {
            id: lesson.id,
            title: lesson.title,
            group: lesson.group,
            startTime: lesson.startTime,
          }
        : null,
      dayLessons: dayLessons.map((l) => ({
        id: l.id,
        title: l.title,
        group: l.group,
        startTime: l.startTime,
      })),
      group,
      groups,
      rows: students.map((s) => ({
        student: { id: s.id, name: s.name, group: s.group },
        status: statusBy.get(s.id) ?? null,
      })),
    };
  }

  async save(teacher: TeacherCtx, dto: AttendanceSaveDto) {
    const { day, lesson, students } = await this.resolve(teacher, dto);
    const valid = new Set<string>(Object.values(StudexaAttendanceStatus));
    const organizationId = OrgContext.require();
    const lessonKey = lesson?.id ?? '';
    // Өмнөх төлөв — шинээр «Тасалсан» болсон сурагчид л мэдэгдэл очно
    const before = new Map(
      (
        await this.prisma.studexaAttendanceRecord.findMany({
          where: {
            studentId: { in: students.map((s) => s.id) },
            date: day,
            lessonKey,
          },
          select: { studentId: true, status: true },
        })
      ).map((r) => [r.studentId, r.status]),
    );
    const newlyAbsent: typeof students = [];
    let saved = 0;
    for (const s of students) {
      const status = dto.statuses?.[s.id];
      if (!status || !valid.has(status)) continue;
      if (
        status === StudexaAttendanceStatus.ABSENT &&
        before.get(s.id) !== StudexaAttendanceStatus.ABSENT
      ) {
        newlyAbsent.push(s);
      }
      await this.prisma.studexaAttendanceRecord.upsert({
        where: {
          organizationId_studentId_date_lessonKey: {
            organizationId,
            studentId: s.id,
            date: day,
            lessonKey,
          },
        },
        create: {
          organizationId,
          studentId: s.id,
          date: day,
          lessonId: lesson?.id ?? null,
          lessonKey,
          status,
        },
        update: { status },
      });
      await recalcAttendance(this.prisma, s.id);
      saved++;
    }
    if (saved === 0) {
      throw new BadRequestException(
        'Нэг ч сурагчийн ирц сонгогдоогүй тул хадгалах зүйл олдсонгүй. Сурагч бүрийн ард төлөвийг нь сонгоно уу.',
      );
    }

    // Хичээлийн сэдэв (журнал) — хичээл сонгосон үед
    if (lesson && dto.topic !== undefined) {
      const topic = dto.topic.trim();
      if (topic) {
        await this.prisma.studexaLessonEntry.upsert({
          where: {
            organizationId_lessonId_date: {
              organizationId,
              lessonId: lesson.id,
              date: day,
            },
          },
          create: {
            organizationId,
            teacherId: teacher.id,
            lessonId: lesson.id,
            date: day,
            topic,
          },
          update: { topic },
        });
      } else {
        await this.prisma.studexaLessonEntry.deleteMany({
          where: { lessonId: lesson.id, date: day },
        });
      }
    }

    // Тасалсан сурагчид (акаунт холбогдсон бол) мэдэгдэл + и-мэйл
    const absentNotified = await this.notifyAbsent(
      newlyAbsent,
      day,
      lesson?.title ?? null,
    );
    return { ok: true, saved, day, absentNotified };
  }

  /**
   * Тасалсны мэдэгдэл — сургууль бүрт байдаг «эцэг эхэд мэдэгдэх» урсгалын
   * эхний хэлбэр: холбогдсон акаунт руу апп-ын мэдэгдэл + (SMTP байвал)
   * и-мэйл. Эцэг эхийн акаунт/утас руу илгээх нь дараагийн шат.
   */
  private async notifyAbsent(
    students: { id: string; name: string; userId: string | null }[],
    day: string,
    lessonTitle: string | null,
  ): Promise<number> {
    const linked = students.filter((s) => s.userId);
    if (linked.length === 0) return 0;
    const where = lessonTitle ? ` (${lessonTitle})` : '';
    await this.notifications.notify(
      linked.map((s) => s.userId!),
      {
        type: 'STUDEXA_ABSENT',
        title: clip(
          `⚠️ ${day.replace(/-/g, '.')}-ний хичээлд${where} тасалсан гэж бүртгэгдлээ`,
          200,
        ),
        refType: 'studexa',
      },
    );
    if (!this.mail.configured) return linked.length;
    const users = await this.prisma.user.findMany({
      where: { id: { in: linked.map((s) => s.userId!) } },
      select: { id: true, username: true, fullName: true },
    });
    for (const u of users) {
      await this.mail.send({
        to: u.username,
        subject: `Studexa — ${day.replace(/-/g, '.')}-ний ирц: тасалсан`,
        text: `Сайн байна уу, ${u.fullName}!\n\n${day.replace(/-/g, '.')}-ний хичээлд${where} тасалсан гэж бүртгэгдлээ. Асуудал байвал багштайгаа холбогдоно уу.\n\n— Studexa / ocirrf`,
      });
    }
    return linked.length;
  }

  /** Ирцийн тайлан: сурагч бүрийн ирсэн/хоцорсон/тасалсан тоо, хувь */
  async exportCsv(teacher: TeacherCtx, group?: string): Promise<string> {
    const students = await this.prisma.studexaStudent.findMany({
      where: {
        teacherId: teacher.id,
        status: 'ACTIVE',
        ...(group ? { group } : {}),
      },
      select: { id: true, name: true, group: true },
      orderBy: [{ group: 'asc' }, { name: 'asc' }],
    });
    if (students.length === 0)
      throw new BadRequestException('Экспортлох сурагч алга');
    const records = await this.prisma.studexaAttendanceRecord.findMany({
      where: { studentId: { in: students.map((s) => s.id) } },
      select: { studentId: true, date: true, lessonId: true, status: true },
    });
    const by = new Map<string, typeof records>();
    for (const r of records) {
      if (!by.has(r.studentId)) by.set(r.studentId, []);
      by.get(r.studentId)!.push(r);
    }
    const rows = students.map((s) => {
      const atts = effectiveAttendances(by.get(s.id) ?? []);
      const present = atts.filter((a) => a.status === 'PRESENT').length;
      const late = atts.filter((a) => a.status === 'LATE').length;
      const absent = atts.filter((a) => a.status === 'ABSENT').length;
      const total = atts.length;
      const pct = total
        ? `${Math.round((100 * (present + late)) / total)}%`
        : '—';
      return [s.name, s.group || '—', total, present, late, absent, pct];
    });
    return buildCsv(
      [
        'Сурагчийн нэр',
        'Бүлэг',
        'Нийт хичээл',
        'Ирсэн',
        'Хоцорсон',
        'Тасалсан',
        'Ирц %',
      ],
      rows,
    );
  }
}
