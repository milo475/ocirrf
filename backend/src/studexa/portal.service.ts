import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import {
  Role,
  StudexaHomeworkStatus,
  StudexaSchoolType,
} from '../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { OrgContext } from '../org/org-context';
import { PERM } from '../permissions/permission-keys';
import { PermissionsService } from '../permissions/permissions.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterStudentDto } from './dto/studexa.dto';
import { StudexaAcademicsService } from './academics.service';
import { StudexaSchoolService } from './school.service';
import {
  buildLineChart,
  buildScheduleGrid,
  buildScheduleSvg,
  buildScoreTable,
  ChartPoint,
  clip,
  shortDate,
  todayStr,
} from './studexa.util';

/**
 * СУРАГЧИЙН ПОРТАЛ: холбогдсон багш бүрийн хуваарь, өөрийн дүн, ирц,
 * даалгавар, төлбөрийн төлөв, зарлал. Нэг акаунт олон багштай холбогдож
 * болно (t= параметрээр шилжинэ).
 */
@Injectable()
export class StudexaPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly permissions: PermissionsService,
    private readonly academics: StudexaAcademicsService,
    private readonly school: StudexaSchoolService,
  ) {}

  /** Сургуулийн нэгдсэн анги (мастер бүртгэлтэй холбогдсон бол): анги, багш нар, нэгдсэн дүн, хуваарь */
  schoolInfo(user: AuthUser) {
    return this.school.portalSchool(user);
  }

  /** Сурагчийн өөрийн дүнгийн хуудас (улирлаар) */
  async reportCard(user: AuthUser, t?: string, termId?: string) {
    const records = await this.records(user);
    const current = records.find((r) => r.id === t) ?? records[0];
    if (!current) throw new NotFoundException('Багштай холбогдоогүй байна');
    const [card, terms] = await Promise.all([
      this.academics.reportCard({ id: current.teacher.id }, current.id, termId),
      this.prisma.studexaTerm.findMany({
        where: { teacherId: current.teacher.id },
        orderBy: { startDate: 'desc' },
        select: { id: true, name: true, isCurrent: true },
      }),
    ]);
    return { ...card, terms };
  }

  private records(user: AuthUser) {
    return this.prisma.studexaStudent.findMany({
      where: { userId: user.id },
      include: {
        teacher: {
          select: {
            id: true,
            code: true,
            schoolType: true,
            user: {
              select: { id: true, fullName: true, username: true, phone: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async portal(user: AuthUser, t?: string) {
    const [records, pending] = await Promise.all([
      this.records(user),
      this.prisma.studexaJoinRequest.findMany({
        where: { userId: user.id },
        include: {
          teacher: {
            select: { user: { select: { fullName: true, username: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const current = records.find((r) => r.id === t) ?? records[0] ?? null;
    const base = {
      records: records.map((r) => ({
        id: r.id,
        name: r.name,
        group: r.group,
        teacherName: r.teacher.user.fullName || r.teacher.user.username,
      })),
      pending: pending.map((p) => ({
        id: p.id,
        teacherName: p.teacher.user.fullName || p.teacher.user.username,
        createdAt: p.createdAt,
      })),
      current: null as null | Record<string, unknown>,
    };
    if (!current) return base;

    const teacher = current.teacher;
    const [
      grid,
      scoreTable,
      attendances,
      payments,
      announcements,
      assessments,
      homeworks,
      pendingHw,
    ] = await Promise.all([
      buildScheduleGrid(this.prisma, teacher.id, current.group),
      buildScoreTable(this.prisma, { id: current.id, teacherId: teacher.id }),
      this.prisma.studexaAttendanceRecord.findMany({
        where: { studentId: current.id },
        include: { lesson: { select: { title: true } } },
        orderBy: { date: 'desc' },
        take: 30,
      }),
      this.prisma.studexaPayment.findMany({
        where: { studentId: current.id },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      }),
      this.prisma.studexaAnnouncement.findMany({
        where: {
          teacherId: teacher.id,
          OR: [{ group: '' }, { group: current.group }],
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.studexaAssessment.findMany({
        where: { studentId: current.id },
        include: { column: { select: { maxScore: true } } },
        orderBy: [{ date: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.studexaHomework.findMany({
        where: { studentId: current.id },
        include: {
          submission: true,
          gradeColumn: { select: { name: true, maxScore: true } },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 20,
      }),
      this.prisma.studexaHomework.count({
        where: {
          studentId: current.id,
          status: { not: StudexaHomeworkStatus.DONE },
        },
      }),
    ]);
    const chart: ChartPoint[] = assessments
      .filter((a) => a.column.maxScore > 0)
      .map((a) => [
        shortDate(a.date),
        Math.round((100 * a.score) / a.column.maxScore),
      ]);
    return {
      ...base,
      current: {
        id: current.id,
        name: current.name,
        group: current.group,
        attendance: current.attendance,
        attendedLessons: current.attendedLessons,
        totalLessons: current.totalLessons,
        missedLessons: Math.max(
          0,
          current.totalLessons - current.attendedLessons,
        ),
        paymentStatus: current.paymentStatus,
        enrolled: current.enrolled,
        teacher: {
          id: teacher.id,
          name: teacher.user.fullName || teacher.user.username,
          email: teacher.user.username,
          phone: teacher.user.phone,
          code: teacher.code,
          schoolType: teacher.schoolType,
        },
        // Их сургуулийн багшийн оюутнуудад төлбөрийн хэсэг харагдахгүй
        hidePayment: teacher.schoolType === StudexaSchoolType.UNIVERSITY,
        schedule: grid,
        hasLessons: grid.days.some((d) => d.lessons.length > 0),
        scoreTable,
        attendances,
        payments,
        announcements,
        progressChart: buildLineChart(chart),
        homeworks,
        pendingHw,
        today: todayStr(),
      },
    };
  }

  /** Нэвтэрсэн (ижил байгууллагын) хэрэглэгч багшийн кодоор хүсэлт илгээнэ */
  async join(user: AuthUser, rawCode: string) {
    const code = rawCode.trim().toLowerCase();
    const teacher = await this.prisma.studexaTeacher.findFirst({
      where: { code },
    });
    if (!teacher)
      throw new NotFoundException(
        'Ийм кодтой багш олдсонгүй. Кодоо шалгаад дахин оруулна уу.',
      );
    if (teacher.userId === user.id)
      throw new BadRequestException('Өөрийнхөө кодоор элсэх боломжгүй');
    const [linked, dup] = await Promise.all([
      this.prisma.studexaStudent.findFirst({
        where: { userId: user.id, teacherId: teacher.id },
        select: { id: true },
      }),
      this.prisma.studexaJoinRequest.findFirst({
        where: { userId: user.id, teacherId: teacher.id },
        select: { id: true },
      }),
    ]);
    if (linked || dup)
      throw new ConflictException(
        'Та энэ багшид аль хэдийн хүсэлт илгээсэн эсвэл холбогдсон байна',
      );
    await this.prisma.studexaJoinRequest.create({
      data: {
        organizationId: OrgContext.require(),
        userId: user.id,
        teacherId: teacher.id,
        phone: user.phone ?? '',
      },
    });
    await this.notifications.notify([teacher.userId], {
      type: 'STUDEXA_JOIN_REQUEST',
      title: clip(`🎓 Шинэ элсэх хүсэлт: ${user.name} (${user.email})`, 200),
      refType: 'studexa',
    });
    return { ok: true };
  }

  /** Сурагч багшийн бүртгэлээс өөрөө салгана */
  async leave(user: AuthUser, recordId: string) {
    const s = await this.prisma.studexaStudent.findFirst({
      where: { id: recordId, userId: user.id },
      include: { teacher: { select: { userId: true } } },
    });
    if (!s) throw new NotFoundException('Бүртгэл олдсонгүй');
    await this.prisma.studexaStudent.update({
      where: { id: s.id },
      data: { userId: null },
    });
    await this.notifications.notify([s.teacher.userId], {
      type: 'STUDEXA_LEFT',
      title: clip(`ℹ️ ${s.name} (${user.name}) таны бүртгэлээс салсан`, 200),
      refType: 'studexa',
      refId: s.id,
    });
    return { ok: true };
  }

  async scheduleSvg(user: AuthUser, t?: string): Promise<string> {
    const records = await this.records(user);
    const current = records.find((r) => r.id === t) ?? records[0];
    if (!current) throw new NotFoundException('Багштай холбогдоогүй байна');
    const grid = await buildScheduleGrid(
      this.prisma,
      current.teacher.id,
      current.group,
    );
    const teacherName =
      current.teacher.user.fullName || current.teacher.user.username;
    return buildScheduleSvg(grid, `Хичээлийн хуваарь — ${teacherName}`);
  }

  // ───────────────────────────── Нээлттэй бүртгэл

  /** Бүртгэлийн формд кодыг урьдчилан шалгах (нэвтрэлтгүй) */
  async checkCode(rawCode: string) {
    const code = rawCode.trim().toLowerCase();
    const teacher = await OrgContext.runBypassed(() =>
      this.prisma.studexaTeacher.findUnique({
        where: { code },
        select: {
          schoolType: true,
          user: { select: { fullName: true } },
          organization: { select: { name: true, isActive: true } },
        },
      }),
    );
    if (!teacher || !teacher.organization.isActive) {
      throw new NotFoundException('Ийм кодтой багш олдсонгүй');
    }
    return {
      ok: true,
      teacherName: teacher.user.fullName,
      organizationName: teacher.organization.name,
      schoolType: teacher.schoolType,
    };
  }

  /**
   * Сурагч багшийн кодоор ӨӨРӨӨ бүртгүүлнэ (нэвтрэлтгүй). Акаунт нь
   * багшийн БАЙГУУЛЛАГАД OPERATOR эрхтэй үүсч, override-оор:
   *   studexa.portal = true  — сурагчийн портал
   *   supplies.view  = false — OPERATOR-ийн default «Нийлүүлэлт» цэс нуугдана
   * Дараа нь багшид элсэх хүсэлт очно; багш баталмагц портал нээгдэнэ.
   *
   * Байгууллага тогтоогдоогүй (нэвтрээгүй) үе тул кодоор багшийг bypass-аар
   * олж, бичилтийг тухайн байгууллагын context дотор (runWith) хийнэ.
   */
  async registerStudent(dto: RegisterStudentDto) {
    const code = dto.teacherCode.trim().toLowerCase();
    const email = dto.email.trim().toLowerCase();
    const teacher = await OrgContext.runBypassed(() =>
      this.prisma.studexaTeacher.findUnique({
        where: { code },
        select: {
          id: true,
          userId: true,
          organizationId: true,
          schoolType: true,
          organization: { select: { isActive: true } },
        },
      }),
    );
    if (!teacher) throw new NotFoundException('Ийм кодтой багш олдсонгүй');
    if (!teacher.organization.isActive) {
      throw new ForbiddenException('Багшийн байгууллагын эрх түдгэлзсэн байна');
    }
    if (
      dto.schoolType === StudexaSchoolType.UNIVERSITY ||
      teacher.schoolType === StudexaSchoolType.UNIVERSITY
    ) {
      for (const [field, label] of [
        ['studentCode', 'Оюутны код'],
        ['lastName', 'Овог'],
        ['phone', 'Утасны дугаар'],
      ] as const) {
        if (!(dto[field] ?? '').trim())
          throw new BadRequestException(`${label} заавал`);
      }
    }
    const exists = await OrgContext.runBypassed(() =>
      this.prisma.user.findUnique({
        where: { username: email },
        select: { id: true },
      }),
    );
    if (exists) throw new ConflictException('Энэ и-мэйл бүртгэлтэй байна');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const fullName = [dto.lastName?.trim(), dto.firstName.trim()]
      .filter(Boolean)
      .join(' ');
    const orgId = teacher.organizationId;
    const user = await OrgContext.runWith(orgId, () =>
      this.prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: {
            username: email,
            passwordHash,
            fullName,
            phone: dto.phone?.trim() || null,
            role: Role.OPERATOR,
            organizationId: orgId,
          },
        });
        await tx.userPermission.createMany({
          data: [
            { userId: u.id, permKey: PERM.STUDEXA_PORTAL, allowed: true },
            { userId: u.id, permKey: PERM.SUPPLIES_VIEW, allowed: false },
          ],
        });
        await tx.studexaJoinRequest.create({
          data: {
            organizationId: orgId,
            userId: u.id,
            teacherId: teacher.id,
            studentCode: (dto.studentCode ?? '').trim().toLowerCase(),
            phone: dto.phone?.trim() ?? '',
            fatherName: dto.fatherName?.trim() ?? '',
            fatherPhone: dto.fatherPhone?.trim() ?? '',
            motherName: dto.motherName?.trim() ?? '',
            motherPhone: dto.motherPhone?.trim() ?? '',
          },
        });
        return u;
      }),
    );
    this.permissions.invalidate(user.id);
    await this.notifications.notify([teacher.userId], {
      type: 'STUDEXA_JOIN_REQUEST',
      title: clip(`🎓 Шинэ элсэх хүсэлт: ${fullName} (${email})`, 200),
      refType: 'studexa',
    });
    return { ok: true, email };
  }
}
