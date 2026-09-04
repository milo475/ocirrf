import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  StudexaMonthPayState,
  StudexaStudentStatus,
} from '../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { OrgContext } from '../org/org-context';
import { PrismaService } from '../prisma/prisma.service';
import {
  AssessmentAddDto,
  GroupAddDto,
  JoinApproveDto,
  PaymentSetDto,
  QueryStudentsDto,
  StudentDto,
} from './dto/studexa.dto';
import {
  buildClassTable,
  buildLineChart,
  buildScoreTable,
  canonicalGroupName,
  ChartPoint,
  clip,
  groupNameError,
  normalizeScale,
  recalcAttendance,
  shortDate,
  syncPaymentStatus,
  teacherGroups,
  todayStr,
} from './studexa.util';
import type { TeacherCtx } from './teacher.service';

/** Гадаад код (frontend/тест)-д хэрэглэх сурагчийн товч select */
const STUDENT_SELECT = {
  id: true,
  name: true,
  studentCode: true,
  registerNo: true,
  birthDate: true,
  gender: true,
  address: true,
  status: true,
  group: true,
  attendance: true,
  attendedLessons: true,
  totalLessons: true,
  paymentStatus: true,
  enrolled: true,
  hwPercent: true,
  phone: true,
  fatherName: true,
  fatherPhone: true,
  motherName: true,
  motherPhone: true,
  userId: true,
  user: { select: { id: true, username: true, fullName: true } },
} as const;

@Injectable()
export class StudexaStudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async requireStudent(teacher: TeacherCtx, id: string) {
    const s = await this.prisma.studexaStudent.findFirst({
      where: { id, teacherId: teacher.id },
    });
    if (!s) throw new NotFoundException('Сурагч олдсонгүй');
    return s;
  }

  private async cleanGroup(teacher: TeacherCtx, raw?: string): Promise<string> {
    const group = (raw ?? '').trim();
    if (!group) return '';
    const err = groupNameError(group);
    if (err) throw new BadRequestException(err);
    return canonicalGroupName(this.prisma, teacher.id, group);
  }

  // ───────────────────────────── Жагсаалт / картууд

  async list(teacher: TeacherCtx, q: QueryStudentsDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const where = {
      teacherId: teacher.id,
      ...(q.q
        ? {
            OR: [
              { name: { contains: q.q, mode: 'insensitive' as const } },
              { group: { contains: q.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(q.group === '__none__'
        ? { group: '' }
        : q.group
          ? { group: q.group }
          : {}),
      ...(q.payment ? { paymentStatus: q.payment } : {}),
      // Төгссөн/шилжсэн сурагч default-аар нуугдана (status=ALL бол бүгд)
      ...(q.status === 'ALL'
        ? {}
        : { status: (q.status ?? 'ACTIVE') as StudexaStudentStatus }),
    };
    const [
      items,
      total,
      cards,
      ungroupedCount,
      joinRequests,
      linkable,
      groups,
    ] = await Promise.all([
      this.prisma.studexaStudent.findMany({
        where,
        select: STUDENT_SELECT,
        orderBy: [{ group: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.studexaStudent.count({ where }),
      this.groupCards(teacher),
      this.prisma.studexaStudent.count({
        where: { teacherId: teacher.id, group: '', status: 'ACTIVE' },
      }),
      this.joinRequests(teacher),
      this.prisma.studexaStudent.findMany({
        where: { teacherId: teacher.id, userId: null },
        select: { id: true, name: true, group: true },
        orderBy: { name: 'asc' },
      }),
      teacherGroups(this.prisma, teacher.id),
    ]);
    return {
      items,
      total,
      page,
      limit,
      groups,
      groupCards: cards,
      ungroupedCount,
      joinRequests,
      linkableStudents: linkable,
    };
  }

  /** Бүлгийн картууд: нэр + сурагчийн тоо (хоосон бүлэг 0-тэй) */
  async groupCards(teacher: TeacherCtx) {
    const [counts, names] = await Promise.all([
      this.prisma.studexaStudent.groupBy({
        by: ['group'],
        where: { teacherId: teacher.id, group: { not: '' }, status: 'ACTIVE' },
        _count: { _all: true },
      }),
      this.prisma.studexaGroup.findMany({
        where: { teacherId: teacher.id },
        select: { name: true },
      }),
    ]);
    const map = new Map<string, number>(
      counts.map((c) => [c.group, c._count._all]),
    );
    for (const n of names) if (!map.has(n.name)) map.set(n.name, 0);
    return [...map.entries()]
      .map(([group, n]) => ({ group, n }))
      .sort((a, b) => a.group.localeCompare(b.group));
  }

  /** Ангийн нэгтгэл (бүлгээр шүүж болно) — жагсаалтын хуудасны хүснэгт */
  async classTable(teacher: TeacherCtx, group?: string, termId?: string) {
    const scale = normalizeScale(
      (
        await this.prisma.studexaTeacher.findUnique({
          where: { id: teacher.id },
          select: { gradingScale: true },
        })
      )?.gradingScale,
    );
    const students = await this.prisma.studexaStudent.findMany({
      where: {
        teacherId: teacher.id,
        status: 'ACTIVE',
        ...(group ? { group } : {}),
      },
      select: {
        id: true,
        name: true,
        group: true,
        attendance: true,
        hwPercent: true,
      },
      orderBy: [{ group: 'asc' }, { name: 'asc' }],
    });
    return buildClassTable(this.prisma, teacher.id, students, {
      termId,
      scale,
    });
  }

  // ───────────────────────────── CRUD

  async create(teacher: TeacherCtx, dto: StudentDto) {
    const group = await this.cleanGroup(teacher, dto.group);
    return this.prisma.studexaStudent.create({
      data: {
        organizationId: OrgContext.require(),
        teacherId: teacher.id,
        name: dto.name.trim(),
        group,
        studentCode: dto.studentCode?.trim() ?? '',
        paymentStatus: dto.paymentStatus,
        enrolled: dto.enrolled ?? todayStr(),
        phone: dto.phone?.trim() ?? '',
        fatherName: dto.fatherName?.trim() ?? '',
        fatherPhone: dto.fatherPhone?.trim() ?? '',
        motherName: dto.motherName?.trim() ?? '',
        motherPhone: dto.motherPhone?.trim() ?? '',
        registerNo: dto.registerNo?.trim() ?? '',
        birthDate: dto.birthDate ?? null,
        gender: dto.gender ?? null,
        address: dto.address?.trim() ?? '',
        status: dto.status ?? 'ACTIVE',
      },
      select: STUDENT_SELECT,
    });
  }

  async get(teacher: TeacherCtx, id: string) {
    const student = await this.prisma.studexaStudent.findFirst({
      where: { id, teacherId: teacher.id },
      select: STUDENT_SELECT,
    });
    if (!student) throw new NotFoundException('Сурагч олдсонгүй');
    const [scoreTable, homeworks, payments, attendances, assessments] =
      await Promise.all([
        buildScoreTable(this.prisma, { id, teacherId: teacher.id }),
        this.prisma.studexaHomework.findMany({
          where: { studentId: id },
          include: {
            gradeColumn: { select: { id: true, name: true, maxScore: true } },
          },
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          take: 50,
        }),
        this.prisma.studexaPayment.findMany({
          where: { studentId: id },
          orderBy: [{ year: 'desc' }, { month: 'asc' }],
        }),
        this.prisma.studexaAttendanceRecord.findMany({
          where: { studentId: id },
          include: { lesson: { select: { title: true } } },
          orderBy: { date: 'desc' },
          take: 10,
        }),
        this.prisma.studexaAssessment.findMany({
          where: { studentId: id },
          include: { column: { select: { maxScore: true } } },
          orderBy: [{ date: 'asc' }, { id: 'asc' }],
        }),
      ]);
    const chart: ChartPoint[] = assessments
      .filter((a) => a.column.maxScore > 0)
      .map((a) => [
        shortDate(a.date),
        Math.round((100 * a.score) / a.column.maxScore),
      ]);
    return {
      student,
      scoreTable,
      homeworks,
      payments,
      attendances,
      progressChart: buildLineChart(chart),
      currentMonth: Number(todayStr().slice(5, 7)),
      currentYear: Number(todayStr().slice(0, 4)),
    };
  }

  async update(teacher: TeacherCtx, id: string, dto: StudentDto) {
    await this.requireStudent(teacher, id);
    const group = await this.cleanGroup(teacher, dto.group);
    return this.prisma.studexaStudent.update({
      where: { id },
      data: {
        name: dto.name.trim(),
        group,
        ...(dto.studentCode !== undefined
          ? { studentCode: dto.studentCode.trim() }
          : {}),
        ...(dto.paymentStatus ? { paymentStatus: dto.paymentStatus } : {}),
        ...(dto.enrolled ? { enrolled: dto.enrolled } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
        ...(dto.fatherName !== undefined
          ? { fatherName: dto.fatherName.trim() }
          : {}),
        ...(dto.fatherPhone !== undefined
          ? { fatherPhone: dto.fatherPhone.trim() }
          : {}),
        ...(dto.motherName !== undefined
          ? { motherName: dto.motherName.trim() }
          : {}),
        ...(dto.motherPhone !== undefined
          ? { motherPhone: dto.motherPhone.trim() }
          : {}),
        ...(dto.registerNo !== undefined
          ? { registerNo: dto.registerNo.trim() }
          : {}),
        ...(dto.birthDate !== undefined ? { birthDate: dto.birthDate } : {}),
        ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
        ...(dto.address !== undefined ? { address: dto.address.trim() } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      select: STUDENT_SELECT,
    });
  }

  async remove(teacher: TeacherCtx, id: string) {
    await this.requireStudent(teacher, id);
    await this.prisma.studexaStudent.delete({ where: { id } });
    return { ok: true };
  }

  /** Багш сурагчийн акаунт-холболтыг салгана */
  async unlink(teacher: TeacherCtx, id: string, teacherName: string) {
    const s = await this.requireStudent(teacher, id);
    if (s.userId) {
      await this.prisma.studexaStudent.update({
        where: { id },
        data: { userId: null },
      });
      await this.notifications.notify([s.userId], {
        type: 'STUDEXA_UNLINKED',
        title: clip(`ℹ️ ${teacherName} багш таны холболтыг салгалаа`, 200),
        refType: 'studexa',
        refId: id,
      });
    }
    return { ok: true };
  }

  // ───────────────────────────── Төлбөр

  async setPayment(teacher: TeacherCtx, id: string, dto: PaymentSetDto) {
    await this.requireStudent(teacher, id);
    const organizationId = OrgContext.require();
    const year = dto.year ?? Number(todayStr().slice(0, 4));
    await this.prisma.studexaPayment.upsert({
      where: {
        organizationId_studentId_year_month: {
          organizationId,
          studentId: id,
          year,
          month: dto.month,
        },
      },
      create: {
        organizationId,
        studentId: id,
        year,
        month: dto.month,
        status: dto.status,
      },
      update: { status: dto.status },
    });
    await syncPaymentStatus(this.prisma, id);
    return { ok: true };
  }

  async deletePayment(
    teacher: TeacherCtx,
    id: string,
    year: number,
    month: number,
  ) {
    await this.requireStudent(teacher, id);
    await this.prisma.studexaPayment.deleteMany({
      where: { studentId: id, year, month },
    });
    await syncPaymentStatus(this.prisma, id);
    return { ok: true };
  }

  // ───────────────────────────── Оноо нэмэх (багана сонгох / шинээр үүсгэх)

  async addAssessment(teacher: TeacherCtx, id: string, dto: AssessmentAddDto) {
    await this.requireStudent(teacher, id);
    const newName = (dto.newColumnName ?? '').trim();
    if (!dto.columnId && !newName) {
      throw new BadRequestException(
        'Байгаа багана сонгох эсвэл шинэ баганын нэрийг бичнэ үү',
      );
    }
    if (dto.columnId && newName) {
      throw new BadRequestException(
        'Багана сонгосон бол шинэ баганын нэрийг хоосон үлдээнэ үү',
      );
    }
    const organizationId = OrgContext.require();
    let column: { id: string; maxScore: number };
    if (dto.columnId) {
      const found = await this.prisma.studexaGradeColumn.findFirst({
        where: { id: dto.columnId, teacherId: teacher.id },
      });
      if (!found) throw new NotFoundException('Багана олдсонгүй');
      column = found;
    } else {
      const last = await this.prisma.studexaGradeColumn.findFirst({
        where: { teacherId: teacher.id },
        orderBy: { order: 'desc' },
      });
      column = await this.prisma.studexaGradeColumn.create({
        data: {
          organizationId,
          teacherId: teacher.id,
          name: newName,
          maxScore: dto.newColumnMax ?? 100,
          order: (last?.order ?? 0) + 1,
        },
      });
    }
    if (dto.score > column.maxScore) {
      throw new BadRequestException(`Дээд оноо ${column.maxScore} байна`);
    }
    await this.prisma.studexaAssessment.upsert({
      where: {
        organizationId_studentId_columnId: {
          organizationId,
          studentId: id,
          columnId: column.id,
        },
      },
      create: {
        organizationId,
        studentId: id,
        columnId: column.id,
        date: dto.date,
        score: dto.score,
      },
      update: { date: dto.date, score: dto.score },
    });
    return { ok: true, columnId: column.id };
  }

  // ───────────────────────────── Бүлэг

  async createGroup(teacher: TeacherCtx, rawName: string) {
    const name = await this.cleanGroup(teacher, rawName);
    if (!name)
      throw new BadRequestException('Бүлгийн нэр хоосон байж болохгүй');
    const organizationId = OrgContext.require();
    await this.prisma.studexaGroup.upsert({
      where: {
        organizationId_teacherId_name: {
          organizationId,
          teacherId: teacher.id,
          name,
        },
      },
      create: { organizationId, teacherId: teacher.id, name },
      update: {},
    });
    return { name };
  }

  async groupDetail(teacher: TeacherCtx, name: string) {
    const [students, available] = await Promise.all([
      this.prisma.studexaStudent.findMany({
        where: { teacherId: teacher.id, group: name },
        select: STUDENT_SELECT,
        orderBy: { name: 'asc' },
      }),
      this.prisma.studexaStudent.findMany({
        where: { teacherId: teacher.id, group: { not: name } },
        select: { id: true, name: true, group: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    const classTable = await buildClassTable(this.prisma, teacher.id, students);
    return { name, students, available, classTable };
  }

  /** Бүртгэлтэй сурагчдаас сонгож бүлэгт нэмнэ (нэр canonical болно) */
  async addToGroup(teacher: TeacherCtx, rawName: string, dto: GroupAddDto) {
    const name = await this.cleanGroup(teacher, rawName);
    if (!name)
      throw new BadRequestException('Бүлгийн нэр хоосон байж болохгүй');
    const res = await this.prisma.studexaStudent.updateMany({
      where: { teacherId: teacher.id, id: { in: dto.studentIds } },
      data: { group: name },
    });
    return { ok: true, name, count: res.count };
  }

  /** Сурагчийг бүлгээс хасна — сурагч устахгүй, бүлэггүй болно */
  async removeFromGroup(teacher: TeacherCtx, name: string, studentId: string) {
    const res = await this.prisma.studexaStudent.updateMany({
      where: { teacherId: teacher.id, id: studentId, group: name },
      data: { group: '' },
    });
    if (res.count === 0)
      throw new NotFoundException('Сурагч энэ бүлэгт олдсонгүй');
    return { ok: true };
  }

  /** Бүлгийг татан буулгана — сурагчид үлдээд бүлэггүй болно */
  async dissolveGroup(teacher: TeacherCtx, name: string) {
    await this.prisma.studexaStudent.updateMany({
      where: { teacherId: teacher.id, group: name },
      data: { group: '' },
    });
    await this.prisma.studexaGroup.deleteMany({
      where: { teacherId: teacher.id, name },
    });
    return { ok: true };
  }

  // ───────────────────────────── Элсэх хүсэлт

  joinRequests(teacher: TeacherCtx) {
    return this.prisma.studexaJoinRequest.findMany({
      where: { teacherId: teacher.id },
      include: {
        user: { select: { id: true, username: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Хүсэлтийг зөвшөөрч Student бичлэгтэй холбоно (шинээр үүсгэх эсвэл
   * байгаа акаунтгүй сурагчтай). Бүртгүүлэхдээ өгсөн утас/эцэг эхийн
   * мэдээлэл хоосон талбаруудад автоматаар орно.
   */
  async approveJoin(teacher: TeacherCtx, id: string, dto: JoinApproveDto) {
    const jr = await this.prisma.studexaJoinRequest.findFirst({
      where: { id, teacherId: teacher.id },
      include: {
        user: {
          select: { id: true, username: true, fullName: true, phone: true },
        },
      },
    });
    if (!jr) throw new NotFoundException('Хүсэлт олдсонгүй');
    const already = await this.prisma.studexaStudent.findFirst({
      where: { teacherId: teacher.id, userId: jr.userId },
      select: { id: true },
    });
    if (already) {
      await this.prisma.studexaJoinRequest.delete({ where: { id } });
      throw new ConflictException(
        'Энэ акаунт аль хэдийн сурагчтай холбогдсон байна',
      );
    }
    const sid = dto.studentId ?? 'new';
    let studentId: string;
    if (sid === 'new') {
      const created = await this.prisma.studexaStudent.create({
        data: {
          organizationId: OrgContext.require(),
          teacherId: teacher.id,
          userId: jr.userId,
          name: clip(jr.user.fullName || jr.user.username, 100),
          group: '',
          enrolled: todayStr(),
          studentCode: jr.studentCode,
          phone: jr.phone || (jr.user.phone ?? ''),
          fatherName: jr.fatherName,
          fatherPhone: jr.fatherPhone,
          motherName: jr.motherName,
          motherPhone: jr.motherPhone,
        },
      });
      studentId = created.id;
    } else {
      const s = await this.prisma.studexaStudent.findFirst({
        where: { id: sid, teacherId: teacher.id, userId: null },
      });
      if (!s)
        throw new NotFoundException(
          'Холбох сурагч олдсонгүй (эсвэл аль хэдийн акаунттай)',
        );
      await this.prisma.studexaStudent.update({
        where: { id: s.id },
        data: {
          userId: jr.userId,
          studentCode: s.studentCode || jr.studentCode,
          phone: s.phone || jr.phone || (jr.user.phone ?? ''),
          fatherName: s.fatherName || jr.fatherName,
          fatherPhone: s.fatherPhone || jr.fatherPhone,
          motherName: s.motherName || jr.motherName,
          motherPhone: s.motherPhone || jr.motherPhone,
        },
      });
      studentId = s.id;
    }
    await this.prisma.studexaJoinRequest.delete({ where: { id } });
    await this.notifications.notify([jr.userId], {
      type: 'STUDEXA_JOIN_APPROVED',
      title: '🎓 Багш таны элсэх хүсэлтийг баталлаа',
      body: 'Хуваарь, дүн, ирц, даалгавар тань порталд харагдана.',
      refType: 'studexa',
      refId: studentId,
    });
    return { ok: true, studentId };
  }

  async rejectJoin(teacher: TeacherCtx, id: string) {
    const res = await this.prisma.studexaJoinRequest.deleteMany({
      where: { id, teacherId: teacher.id },
    });
    if (res.count === 0) throw new NotFoundException('Хүсэлт олдсонгүй');
    return { ok: true };
  }

  /** Ирц бүртгэлээс дахин тооцох (сервисийн гаднаас дуудахад) */
  recalc(studentId: string) {
    return recalcAttendance(this.prisma, studentId);
  }

  /** Сарын төлбөрийн төлөвүүд — портал/энгийн хуудсанд */
  static monthStates(): StudexaMonthPayState[] {
    return Object.values(StudexaMonthPayState);
  }
}
