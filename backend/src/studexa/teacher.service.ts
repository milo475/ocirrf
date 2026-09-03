import {
  BadRequestException,
  ConflictException,
  Injectable,
  PreconditionFailedException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import {
  StudexaAttendanceStatus,
  StudexaHomeworkStatus,
  StudexaPayState,
  StudexaSchoolType,
} from '../generated/prisma/client';
import { OrgContext } from '../org/org-context';
import { PERM } from '../permissions/permission-keys';
import { PermissionsService } from '../permissions/permissions.service';
import { PrismaService } from '../prisma/prisma.service';
import { SetupTeacherDto, UpdateTeacherDto } from './dto/studexa.dto';
import {
  addDays,
  buildClassTable,
  buildLineChart,
  ChartPoint,
  shortDate,
  TEACHER_CODE_PREFIXES,
  todayStr,
  weekdayOf,
} from './studexa.util';

/** Controller-уудад дамжих багшийн товч context */
export type TeacherCtx = {
  id: string;
  userId: string;
  code: string;
  schoolType: StudexaSchoolType;
};

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    (e as { code?: string }).code === 'P2002'
  );
}

@Injectable()
export class StudexaTeacherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  find(userId: string) {
    return this.prisma.studexaTeacher.findUnique({ where: { userId } });
  }

  /**
   * studexa.teach эрхтэй ч профайл үүсгээгүй хэрэглэгчид 412 — frontend
   * үүнийг бариад «сургуулийн төрөл сонгох» дэлгэц рүү шилжүүлнэ.
   */
  async require(user: AuthUser): Promise<TeacherCtx> {
    const t = await this.find(user.id);
    if (!t) {
      throw new PreconditionFailedException(
        'Багшийн профайл үүсгээгүй байна — эхлээд сургуулийн төрлөө сонгоно уу',
      );
    }
    return {
      id: t.id,
      userId: t.userId,
      code: t.code,
      schoolType: t.schoolType,
    };
  }

  /** Нэвтэрсэн хэрэглэгчийн Studexa дахь байр суурь (нүүр хуудас шийднэ) */
  async me(user: AuthUser) {
    const [teacher, canTeach, canPortal, studentRecords, pendingRequests] =
      await Promise.all([
        this.find(user.id),
        this.permissions.has(user.id, user.role, PERM.STUDEXA_TEACH),
        this.permissions.has(user.id, user.role, PERM.STUDEXA_PORTAL),
        this.prisma.studexaStudent.count({ where: { userId: user.id } }),
        this.prisma.studexaJoinRequest.count({ where: { userId: user.id } }),
      ]);
    return {
      teacher: teacher
        ? {
            id: teacher.id,
            code: teacher.code,
            schoolType: teacher.schoolType,
            createdAt: teacher.createdAt,
          }
        : null,
      canTeach,
      canPortal,
      studentRecords,
      pendingRequests,
    };
  }

  /**
   * Багшийн профайл үүсгэх. Их сургуулийн багш ӨӨРИЙН кодоо оруулна;
   * бусдад систем trt####/stdx####/stu#### код олгоно. Код нь ГЛОБАЛ
   * unique (сурагч өөр байгууллагаас ч кодоор нь олдог) тул bypass-аар
   * шалгана — уншилт л хийнэ, бичилт нь өөрийн байгууллагад.
   */
  async setup(user: AuthUser, dto: SetupTeacherDto) {
    if (await this.find(user.id)) {
      throw new ConflictException('Багшийн профайл аль хэдийн үүссэн байна');
    }
    const organizationId = OrgContext.require();
    if (dto.schoolType === StudexaSchoolType.UNIVERSITY) {
      const code = (dto.code ?? '').trim().toLowerCase();
      if (!code) {
        throw new BadRequestException(
          'Сургуулиасаа авсан багшийн кодоо оруулна уу',
        );
      }
      const taken = await OrgContext.runBypassed(() =>
        this.prisma.studexaTeacher.findUnique({
          where: { code },
          select: { id: true },
        }),
      );
      if (taken)
        throw new ConflictException('Энэ кодоор өмнө нь бүртгүүлсэн байна');
      try {
        return await this.prisma.studexaTeacher.create({
          data: {
            organizationId,
            userId: user.id,
            code,
            schoolType: dto.schoolType,
          },
        });
      } catch (e) {
        if (isUniqueViolation(e))
          throw new ConflictException('Энэ кодоор өмнө нь бүртгүүлсэн байна');
        throw e;
      }
    }
    const prefix = TEACHER_CODE_PREFIXES[dto.schoolType]!;
    // Зэрэг хоёр багш бүртгүүлэхэд код давхардаж болзошгүй — дахин оролдоно
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = await this.nextCode(prefix);
      try {
        return await this.prisma.studexaTeacher.create({
          data: {
            organizationId,
            userId: user.id,
            code,
            schoolType: dto.schoolType,
          },
        });
      } catch (e) {
        if (!isUniqueViolation(e)) throw e;
      }
    }
    throw new ConflictException(
      'Багшийн код олгоход алдаа гарлаа — дахин оролдоно уу',
    );
  }

  /** Дараагийн код: trt0000, trt0001, … — тоогоор жишнэ (9999 → 10000 зөв) */
  private async nextCode(prefix: string): Promise<string> {
    const rows = await OrgContext.runBypassed(() =>
      this.prisma.studexaTeacher.findMany({
        where: { code: { startsWith: prefix } },
        select: { code: true },
      }),
    );
    const numbers = rows
      .map((r) => r.code.slice(prefix.length))
      .filter((n) => /^\d+$/.test(n))
      .map(Number);
    const next = numbers.length ? Math.max(...numbers) + 1 : 0;
    return `${prefix}${String(next).padStart(4, '0')}`;
  }

  update(teacher: TeacherCtx, dto: UpdateTeacherDto) {
    return this.prisma.studexaTeacher.update({
      where: { id: teacher.id },
      data: { ...(dto.schoolType ? { schoolType: dto.schoolType } : {}) },
    });
  }

  /** Багшийн хяналт самбар — Studexa-гийн dashboard view-тэй ижил тоонууд */
  async dashboard(teacher: TeacherCtx) {
    const today = todayStr();
    const weekday = weekdayOf(today);
    const students = await this.prisma.studexaStudent.findMany({
      where: { teacherId: teacher.id },
      select: {
        id: true,
        name: true,
        group: true,
        attendance: true,
        hwPercent: true,
        paymentStatus: true,
      },
    });
    const studentIds = students.map((s) => s.id);

    const [pendingHomework, lessons, notes, attRows] = await Promise.all([
      studentIds.length
        ? this.prisma.studexaHomework.count({
            where: {
              studentId: { in: studentIds },
              status: { not: StudexaHomeworkStatus.DONE },
            },
          })
        : Promise.resolve(0),
      this.prisma.studexaLesson.findMany({
        where: { teacherId: teacher.id, weekday },
        orderBy: { startTime: 'asc' },
      }),
      this.prisma.studexaNote.findMany({
        where: { teacherId: teacher.id },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
      studentIds.length
        ? this.prisma.studexaAttendanceRecord.findMany({
            where: {
              studentId: { in: studentIds },
              date: { gte: addDays(today, -13) },
            },
            select: {
              studentId: true,
              date: true,
              status: true,
              lessonId: true,
            },
          })
        : Promise.resolve(
            [] as {
              studentId: string;
              date: string;
              status: StudexaAttendanceStatus;
              lessonId: string | null;
            }[],
          ),
    ]);

    // Ирцийн трэнд: сүүлийн 14 хоногийн бүртгэлтэй өдрүүдийн ирцийн %
    const lessonDates = new Set(
      attRows.filter((a) => a.lessonId).map((a) => `${a.studentId}|${a.date}`),
    );
    const byDay = new Map<string, { total: number; attended: number }>();
    for (const a of attRows) {
      if (!a.lessonId && lessonDates.has(`${a.studentId}|${a.date}`)) continue;
      const d = byDay.get(a.date) ?? { total: 0, attended: 0 };
      d.total += 1;
      if (a.status !== StudexaAttendanceStatus.ABSENT) d.attended += 1;
      byDay.set(a.date, d);
    }
    const trend: ChartPoint[] = [...byDay.keys()].sort().map((d) => {
      const s = byDay.get(d)!;
      return [shortDate(d), Math.round((100 * s.attended) / s.total)];
    });

    // Бүлэг бүрийн дундаж нийт оноо
    const groups = [
      ...new Set(students.filter((s) => s.group).map((s) => s.group)),
    ].sort();
    const groupBars: { label: string; value: number }[] = [];
    for (const g of groups) {
      const table = await buildClassTable(
        this.prisma,
        teacher.id,
        students.filter((s) => s.group === g),
      );
      const grands = table.rows
        .map((r) => r.grand)
        .filter((v): v is number => v !== null);
      if (grands.length) {
        groupBars.push({
          label: g,
          value: Math.round(grands.reduce((a, b) => a + b, 0) / grands.length),
        });
      }
    }

    const groupCounts = new Map<string, number>();
    for (const s of students) {
      if (s.group)
        groupCounts.set(s.group, (groupCounts.get(s.group) ?? 0) + 1);
    }

    return {
      today,
      totalStudents: students.length,
      todayLessons: lessons.map((l) => ({
        id: l.id,
        title: l.title,
        group: l.group,
        startTime: l.startTime,
        endTime: l.endTime,
        color: l.color,
        students: l.group ? (groupCounts.get(l.group) ?? 0) : students.length,
      })),
      pendingHomework,
      overduePayments: students.filter(
        (s) => s.paymentStatus === StudexaPayState.OVERDUE,
      ).length,
      notes,
      attChart: buildLineChart(trend),
      groupBars,
    };
  }
}
