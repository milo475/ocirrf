import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import {
  StudexaGender,
  StudexaStudentStatus,
} from '../generated/prisma/client';
import { OrgContext } from '../org/org-context';
import { PERM } from '../permissions/permission-keys';
import { PermissionsService } from '../permissions/permissions.service';
import { PrismaService } from '../prisma/prisma.service';
import { StudexaAcademicsService } from './academics.service';
import {
  ClassDto,
  ClassTeacherDto,
  LinkPupilDto,
  PupilDto,
} from './dto/studexa.dto';
import {
  DEFAULT_GRADING_SCALE,
  gridFromLessons,
  groupNameError,
  letterFor,
  parseStudentCsv,
  todayStr,
} from './studexa.util';

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    (e as { code?: string }).code === 'P2002'
  );
}

/** Мастер → roster руу хуулагдах профайлын талбарууд */
type Profile = {
  name: string;
  registerNo: string;
  birthDate: string | null;
  gender: StudexaGender | null;
  address: string;
  phone: string;
  fatherName: string;
  fatherPhone: string;
  motherName: string;
  motherPhone: string;
  status: StudexaStudentStatus;
};
function profileOf(p: Profile): Profile {
  return {
    name: p.name,
    registerNo: p.registerNo,
    birthDate: p.birthDate,
    gender: p.gender,
    address: p.address,
    phone: p.phone,
    fatherName: p.fatherName,
    fatherPhone: p.fatherPhone,
    motherName: p.motherName,
    motherPhone: p.motherPhone,
    status: p.status,
  };
}

type PupilRow = Profile & {
  id: string;
  userId: string | null;
  enrolled: string;
};

type ClassRow = {
  id: string;
  name: string;
  homeroomTeacherId: string | null;
  teachers: { teacherId: string }[];
};

const TEACHER_SELECT = {
  id: true,
  code: true,
  user: { select: { fullName: true, username: true } },
} as const;
const teacherName = (t: {
  user: { fullName: string | null; username: string };
}) => t.user.fullName || t.user.username;

/**
 * НЭГДСЭН АНГИ (сургуулийн түвшин). Studexa-гийн бүх логик багш бүрээр
 * тусгаарлагдсан хэвээр; энэ service нь дээр нь «сургуулийн давхарга» нэмнэ:
 *  - StudexaSchoolClass: байгууллагын анги, ангийн багш (homeroom), хичээлийн багш нар
 *  - StudexaPupil: сурагчийн мастер бүртгэл — ангийн багш бүрд StudexaStudent
 *    roster мөр АВТОМАТААР үүсч (ensureRosters), профайл/акаунт тархана (propagate)
 *  - нэгдсэн дүнгийн хуудас (бүх багшийн одоогийн улирал), нэгдсэн хуваарь, ирц
 * Эрх: studexa.manage — бүх анги; ангийн багш — өөрийн ангиа засна; хичээлийн
 * багш — өөрийн ангиа харна.
 */
@Injectable()
export class StudexaSchoolService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly academics: StudexaAcademicsService,
  ) {}

  canManage(user: AuthUser) {
    return this.permissions.has(user.id, user.role, PERM.STUDEXA_MANAGE);
  }

  private myTeacher(user: AuthUser) {
    return this.prisma.studexaTeacher.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });
  }

  private async requireManage(user: AuthUser) {
    if (!(await this.canManage(user)))
      throw new ForbiddenException(
        'Сургуулийн удирдлагын эрх (studexa.manage) шаардлагатай',
      );
  }

  private async access(user: AuthUser, cls: ClassRow, write: boolean) {
    const [manage, t] = await Promise.all([
      this.canManage(user),
      this.myTeacher(user),
    ]);
    const isHomeroom = Boolean(t && cls.homeroomTeacherId === t.id);
    const member =
      isHomeroom ||
      Boolean(t && cls.teachers.some((x) => x.teacherId === t.id));
    if (!manage && !member) throw new NotFoundException('Анги олдсонгүй');
    if (write && !manage && !isHomeroom)
      throw new ForbiddenException(
        'Зөвхөн ангийн багш эсвэл сургуулийн удирдлага өөрчилнө',
      );
    return {
      manage,
      teacherId: t?.id ?? null,
      isHomeroom,
      canWrite: manage || isHomeroom,
    };
  }

  private async requireClass(user: AuthUser, id: string, write = false) {
    const cls = await this.prisma.studexaSchoolClass.findFirst({
      where: { id },
      include: { teachers: { select: { teacherId: true } } },
    });
    if (!cls) throw new NotFoundException('Анги олдсонгүй');
    const acc = await this.access(user, cls, write);
    return { cls, ...acc };
  }

  private async requirePupil(user: AuthUser, id: string, write = false) {
    const pupil = await this.prisma.studexaPupil.findFirst({
      where: { id },
      include: {
        class: { include: { teachers: { select: { teacherId: true } } } },
      },
    });
    if (!pupil) throw new NotFoundException('Сурагч олдсонгүй');
    if (!pupil.class) {
      await this.requireManage(user);
      return {
        pupil,
        manage: true,
        teacherId: null as string | null,
        isHomeroom: false,
        canWrite: true,
      };
    }
    const acc = await this.access(user, pupil.class, write);
    return { pupil, ...acc };
  }

  /** Ангид хамаарах бүх багш (хичээлийн багш нар + ангийн багш) */
  private memberTeacherIds(cls: ClassRow): string[] {
    const ids = new Set(cls.teachers.map((t) => t.teacherId));
    if (cls.homeroomTeacherId) ids.add(cls.homeroomTeacherId);
    return [...ids];
  }

  // ───────────────────────────── Анги

  async listClasses(user: AuthUser) {
    const [manage, t] = await Promise.all([
      this.canManage(user),
      this.myTeacher(user),
    ]);
    const where = manage
      ? {}
      : t
        ? {
            OR: [
              { homeroomTeacherId: t.id },
              { teachers: { some: { teacherId: t.id } } },
            ],
          }
        : { id: '__none__' };
    const classes = await this.prisma.studexaSchoolClass.findMany({
      where,
      orderBy: [{ grade: 'asc' }, { name: 'asc' }],
      include: {
        homeroomTeacher: { select: TEACHER_SELECT },
        _count: {
          select: {
            teachers: true,
            pupils: { where: { status: StudexaStudentStatus.ACTIVE } },
          },
        },
      },
    });
    return {
      canManage: manage,
      teacherId: t?.id ?? null,
      items: classes.map((c) => ({
        id: c.id,
        name: c.name,
        grade: c.grade,
        homeroomTeacher: c.homeroomTeacher
          ? {
              id: c.homeroomTeacher.id,
              code: c.homeroomTeacher.code,
              name: teacherName(c.homeroomTeacher),
            }
          : null,
        teachers: c._count.teachers,
        pupils: c._count.pupils,
        isHomeroom: Boolean(t && c.homeroomTeacherId === t.id),
      })),
    };
  }

  private async checkTeacher(id: string | undefined) {
    if (!id) return null;
    const t = await this.prisma.studexaTeacher.findFirst({
      where: { id },
      select: { id: true },
    });
    if (!t) throw new BadRequestException('Багш олдсонгүй');
    return t.id;
  }

  async createClass(user: AuthUser, dto: ClassDto) {
    await this.requireManage(user);
    const name = dto.name.trim();
    const err = groupNameError(name);
    if (err) throw new BadRequestException(err);
    const homeroomTeacherId = await this.checkTeacher(dto.homeroomTeacherId);
    const cls = await this.prisma.studexaSchoolClass
      .create({
        data: {
          organizationId: OrgContext.require(),
          name,
          grade: dto.grade ?? null,
          homeroomTeacherId,
        },
      })
      .catch((e: unknown) => {
        if (isUniqueViolation(e))
          throw new ConflictException('Ийм нэртэй анги аль хэдийн байна');
        throw e;
      });
    // Ангийн багш нь мөн ангийн roster-той (өөрийн бүлэгт сурагчид харагдана)
    if (homeroomTeacherId) {
      await this.addTeacherRow(cls.id, homeroomTeacherId);
      await this.ensureRosters(cls, [homeroomTeacherId]);
    }
    return cls;
  }

  private async addTeacherRow(
    classId: string,
    teacherId: string,
    subjectId: string | null = null,
  ) {
    const organizationId = OrgContext.require();
    await this.prisma.studexaClassTeacher.upsert({
      where: {
        organizationId_classId_teacherId: {
          organizationId,
          classId,
          teacherId,
        },
      },
      create: { organizationId, classId, teacherId, subjectId },
      update: subjectId ? { subjectId } : {},
    });
  }

  async updateClass(user: AuthUser, id: string, dto: ClassDto) {
    await this.requireManage(user);
    const { cls } = await this.requireClass(user, id);
    const name = dto.name.trim();
    const err = groupNameError(name);
    if (err) throw new BadRequestException(err);
    const homeroomTeacherId = await this.checkTeacher(dto.homeroomTeacherId);
    try {
      await this.prisma.studexaSchoolClass.update({
        where: { id },
        data: { name, grade: dto.grade ?? null, homeroomTeacherId },
      });
    } catch (e) {
      if (isUniqueViolation(e))
        throw new ConflictException('Ийм нэртэй анги аль хэдийн байна');
      throw e;
    }
    if (name !== cls.name) await this.renameGroups(cls, name);
    if (homeroomTeacherId) {
      await this.addTeacherRow(id, homeroomTeacherId);
      await this.ensureRosters({ id, name }, [homeroomTeacherId]);
    }
    return this.prisma.studexaSchoolClass.findFirst({ where: { id } });
  }

  /** Анги нэр солиход багш бүрийн бүлэг, roster, хуваарь дагаж солигдоно */
  private async renameGroups(cls: ClassRow, name: string) {
    const organizationId = OrgContext.require();
    const teacherIds = this.memberTeacherIds(cls);
    const pupilIds = (
      await this.prisma.studexaPupil.findMany({
        where: { classId: cls.id },
        select: { id: true },
      })
    ).map((p) => p.id);
    if (pupilIds.length)
      await this.prisma.studexaStudent.updateMany({
        where: { pupilId: { in: pupilIds } },
        data: { group: name },
      });
    for (const teacherId of teacherIds) {
      await this.prisma.studexaGroup.deleteMany({
        where: { teacherId, name: cls.name },
      });
      await this.prisma.studexaGroup.upsert({
        where: {
          organizationId_teacherId_name: { organizationId, teacherId, name },
        },
        create: { organizationId, teacherId, name },
        update: {},
      });
    }
    if (teacherIds.length)
      await this.prisma.studexaLesson.updateMany({
        where: { teacherId: { in: teacherIds }, group: cls.name },
        data: { group: name },
      });
  }

  /** Анги устгахад мастер бүртгэл ангигүй болно, багшийн roster хэвээр */
  async deleteClass(user: AuthUser, id: string) {
    await this.requireManage(user);
    await this.requireClass(user, id);
    await this.prisma.studexaSchoolClass.delete({ where: { id } });
    return { ok: true };
  }

  /** Байгууллагын бүх багш (ангид оноох сонголт) */
  async orgTeachers(user: AuthUser) {
    await this.requireManage(user);
    const teachers = await this.prisma.studexaTeacher.findMany({
      select: {
        ...TEACHER_SELECT,
        schoolType: true,
        subjects: {
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { code: 'asc' },
    });
    return teachers.map((t) => ({
      id: t.id,
      code: t.code,
      name: teacherName(t),
      email: t.user.username,
      subjects: t.subjects,
    }));
  }

  async addTeacher(user: AuthUser, id: string, dto: ClassTeacherDto) {
    await this.requireManage(user);
    const { cls } = await this.requireClass(user, id);
    const teacherId = (await this.checkTeacher(dto.teacherId))!;
    let subjectId: string | null = null;
    if (dto.subjectId) {
      const s = await this.prisma.studexaSubject.findFirst({
        where: { id: dto.subjectId, teacherId },
        select: { id: true },
      });
      if (!s)
        throw new BadRequestException(
          'Хичээл энэ багшийнх биш эсвэл олдсонгүй',
        );
      subjectId = s.id;
    }
    await this.addTeacherRow(cls.id, teacherId, subjectId);
    await this.ensureRosters(cls, [teacherId]);
    return { ok: true };
  }

  /** Багшийг ангиас хасахад roster/түүх нь хэвээр (багшийн өөрийн өгөгдөл) */
  async removeTeacher(user: AuthUser, id: string, teacherId: string) {
    await this.requireManage(user);
    await this.requireClass(user, id);
    const res = await this.prisma.studexaClassTeacher.deleteMany({
      where: { classId: id, teacherId },
    });
    if (res.count === 0) throw new NotFoundException('Багш энэ ангид алга');
    return { ok: true };
  }

  async classDetail(user: AuthUser, id: string) {
    const { cls, manage, canWrite, teacherId } = await this.requireClass(
      user,
      id,
    );
    const [full, pupils] = await Promise.all([
      this.prisma.studexaSchoolClass.findFirst({
        where: { id },
        include: {
          homeroomTeacher: { select: TEACHER_SELECT },
          teachers: {
            include: {
              teacher: { select: TEACHER_SELECT },
              subject: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      this.prisma.studexaPupil.findMany({
        where: { classId: id },
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
        include: { user: { select: { id: true, username: true } } },
      }),
    ]);
    const rosters = pupils.length
      ? await this.prisma.studexaStudent.findMany({
          where: { pupilId: { in: pupils.map((p) => p.id) } },
          select: {
            pupilId: true,
            attendedLessons: true,
            totalLessons: true,
            hwPercent: true,
          },
        })
      : [];
    const agg = new Map<
      string,
      { attended: number; total: number; rosters: number }
    >();
    for (const r of rosters) {
      const a = agg.get(r.pupilId!) ?? { attended: 0, total: 0, rosters: 0 };
      a.attended += r.attendedLessons;
      a.total += r.totalLessons;
      a.rosters++;
      agg.set(r.pupilId!, a);
    }
    return {
      canManage: manage,
      canWrite,
      myTeacherId: teacherId,
      class: {
        id: full!.id,
        name: full!.name,
        grade: full!.grade,
        homeroomTeacher: full!.homeroomTeacher
          ? {
              id: full!.homeroomTeacher.id,
              code: full!.homeroomTeacher.code,
              name: teacherName(full!.homeroomTeacher),
            }
          : null,
      },
      teachers: full!.teachers.map((ct) => ({
        id: ct.id,
        teacher: {
          id: ct.teacher.id,
          code: ct.teacher.code,
          name: teacherName(ct.teacher),
        },
        subject: ct.subject,
      })),
      pupils: pupils.map((p) => {
        const a = agg.get(p.id);
        return {
          ...profileOf(p),
          id: p.id,
          enrolled: p.enrolled,
          userId: p.userId,
          user: p.user,
          attendance: {
            attended: a?.attended ?? 0,
            total: a?.total ?? 0,
            percent:
              a && a.total ? Math.round((100 * a.attended) / a.total) : null,
          },
          rosters: a?.rosters ?? 0,
        };
      }),
      timetable: await this.classTimetable(cls),
    };
  }

  /** Ангийн нэгдсэн хуваарь — бүх багшийн энэ ангид (эсвэл бүх бүлэгт) заадаг хичээлүүд */
  private async classTimetable(cls: ClassRow) {
    const teacherIds = this.memberTeacherIds(cls);
    if (teacherIds.length === 0) return gridFromLessons([]);
    const lessons = await this.prisma.studexaLesson.findMany({
      where: {
        teacherId: { in: teacherIds },
        OR: [{ group: '' }, { group: cls.name }],
      },
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
      include: {
        subject: { select: { name: true } },
        teacher: { select: TEACHER_SELECT },
      },
    });
    return gridFromLessons(
      lessons.map((l) => ({ ...l, teacherName: teacherName(l.teacher) })),
    );
  }

  // ───────────────────────────── Сурагчийн мастер бүртгэл

  private pupilData(dto: PupilDto) {
    return {
      name: dto.name.trim(),
      phone: dto.phone?.trim() ?? '',
      fatherName: dto.fatherName?.trim() ?? '',
      fatherPhone: dto.fatherPhone?.trim() ?? '',
      motherName: dto.motherName?.trim() ?? '',
      motherPhone: dto.motherPhone?.trim() ?? '',
      registerNo: dto.registerNo?.trim() ?? '',
      birthDate: dto.birthDate ?? null,
      gender: dto.gender ?? null,
      address: dto.address?.trim() ?? '',
      status: dto.status ?? StudexaStudentStatus.ACTIVE,
    };
  }

  async addPupil(user: AuthUser, classId: string, dto: PupilDto) {
    const { cls } = await this.requireClass(user, classId, true);
    const pupil = await this.prisma.studexaPupil.create({
      data: {
        organizationId: OrgContext.require(),
        classId: cls.id,
        enrolled: todayStr(),
        ...this.pupilData(dto),
      },
    });
    await this.ensureRosters(cls, undefined, [pupil]);
    return pupil;
  }

  async importPupils(user: AuthUser, classId: string, buffer: Buffer) {
    const { cls } = await this.requireClass(user, classId, true);
    const { rows, skipped } = parseStudentCsv(buffer);
    const organizationId = OrgContext.require();
    const created: PupilRow[] = [];
    for (const r of rows) {
      created.push(
        await this.prisma.studexaPupil.create({
          data: {
            organizationId,
            classId: cls.id,
            enrolled: todayStr(),
            name: r.name,
            phone: r.phone,
            fatherName: r.fatherName,
            fatherPhone: r.fatherPhone,
            motherName: r.motherName,
            motherPhone: r.motherPhone,
            birthDate: r.birthDate,
            gender: r.gender,
            registerNo: r.registerNo,
            address: r.address,
          },
        }),
      );
    }
    if (created.length) await this.ensureRosters(cls, undefined, created);
    return {
      created: created.length,
      names: created.slice(0, 50).map((p) => p.name),
      skipped,
    };
  }

  async updatePupil(user: AuthUser, id: string, dto: PupilDto) {
    await this.requirePupil(user, id, true);
    const pupil = await this.prisma.studexaPupil.update({
      where: { id },
      data: this.pupilData(dto),
    });
    await this.propagate(pupil);
    return pupil;
  }

  /** Ангиас гаргах = төлөв LEFT (мэдээлэл, түүх хадгалагдана) */
  async leavePupil(user: AuthUser, id: string) {
    await this.requirePupil(user, id, true);
    const pupil = await this.prisma.studexaPupil.update({
      where: { id },
      data: { status: StudexaStudentStatus.LEFT },
    });
    await this.propagate(pupil);
    return { ok: true };
  }

  /** Бүрмөсөн устгах — багш бүрийн roster (ирц, дүн) хамт устана */
  async deletePupil(user: AuthUser, id: string) {
    await this.requireManage(user);
    await this.requirePupil(user, id);
    await this.prisma.studexaStudent.deleteMany({ where: { pupilId: id } });
    await this.prisma.studexaPupil.delete({ where: { id } });
    return { ok: true };
  }

  /** Сурагчийн акаунтыг (байгууллагын хэрэглэгч) мастерт холбож бүх roster-т тархаана */
  async linkPupil(user: AuthUser, id: string, dto: LinkPupilDto) {
    await this.requirePupil(user, id, true);
    const u = await this.prisma.user.findFirst({
      where: { username: dto.email.trim().toLowerCase(), isActive: true },
      select: { id: true, role: true },
    });
    if (!u)
      throw new NotFoundException('Ийм и-мэйлтэй хэрэглэгч байгууллагад алга');
    const taken = await this.prisma.studexaPupil.findFirst({
      where: { userId: u.id, id: { not: id } },
      select: { name: true },
    });
    if (taken)
      throw new ConflictException(
        `Энэ акаунт «${taken.name}» сурагчтай аль хэдийн холбогдсон`,
      );
    await this.prisma.studexaPupil.update({
      where: { id },
      data: { userId: u.id },
    });
    await this.propagateUser(id, u.id);
    // Портал эрх (сурагч /studexa/register-ээр бүртгүүлээгүй бол)
    await this.prisma.userPermission.upsert({
      where: { userId_permKey: { userId: u.id, permKey: PERM.STUDEXA_PORTAL } },
      create: { userId: u.id, permKey: PERM.STUDEXA_PORTAL, allowed: true },
      update: { allowed: true },
    });
    this.permissions.invalidate(u.id);
    return { ok: true };
  }

  async unlinkPupil(user: AuthUser, id: string) {
    await this.requirePupil(user, id, true);
    await this.prisma.studexaPupil.update({
      where: { id },
      data: { userId: null },
    });
    await this.prisma.studexaStudent.updateMany({
      where: { pupilId: id },
      data: { userId: null },
    });
    return { ok: true };
  }

  async pupilDetail(user: AuthUser, id: string) {
    const { pupil, canWrite, manage } = await this.requirePupil(user, id);
    const rosters = await this.prisma.studexaStudent.findMany({
      where: { pupilId: id },
      include: { teacher: { select: TEACHER_SELECT } },
      orderBy: { createdAt: 'asc' },
    });
    const subjectBy = new Map<string, string | null>();
    if (pupil.classId) {
      const cts = await this.prisma.studexaClassTeacher.findMany({
        where: { classId: pupil.classId },
        include: { subject: { select: { name: true } } },
      });
      for (const ct of cts)
        subjectBy.set(ct.teacherId, ct.subject?.name ?? null);
    }
    const rosterRows = rosters.map((r) => ({
      id: r.id,
      teacher: {
        id: r.teacher.id,
        code: r.teacher.code,
        name: teacherName(r.teacher),
      },
      subject: subjectBy.get(r.teacherId) ?? null,
      group: r.group,
      attendance: r.attendance,
      hwPercent: r.hwPercent,
      paymentStatus: r.paymentStatus,
      userId: r.userId,
    }));
    const attendances = rosters.length
      ? await this.prisma.studexaAttendanceRecord.findMany({
          where: { studentId: { in: rosters.map((r) => r.id) } },
          include: { lesson: { select: { title: true } } },
          orderBy: { date: 'desc' },
          take: 40,
        })
      : [];
    const teacherOfRoster = new Map(
      rosterRows.map((r) => [r.id, r.teacher.name]),
    );
    const cls = pupil.class
      ? {
          id: pupil.class.id,
          name: pupil.class.name,
          grade: pupil.class.grade,
          homeroomTeacherId: pupil.class.homeroomTeacherId,
          teachers: pupil.class.teachers,
        }
      : null;
    return {
      canWrite,
      canManage: manage,
      pupil: {
        ...profileOf(pupil),
        id: pupil.id,
        enrolled: pupil.enrolled,
        userId: pupil.userId,
        createdAt: pupil.createdAt,
      },
      class: cls ? { id: cls.id, name: cls.name, grade: cls.grade } : null,
      rosters: rosterRows,
      attendances: attendances.map((a) => ({
        id: a.id,
        date: a.date,
        status: a.status,
        lessonTitle: a.lesson?.title ?? null,
        teacherName: teacherOfRoster.get(a.studentId) ?? '',
      })),
      report: await this.pupilReport(rosterRows),
      timetable: cls ? await this.classTimetable(cls) : gridFromLessons([]),
    };
  }

  /** Нэгдсэн дүнгийн хуудас: багш (хичээл) бүрийн ОДООГИЙН улирлын дүнгийн хуудас + дундаж */
  private async pupilReport(
    rosters: {
      id: string;
      teacher: { id: string; name: string };
      subject: string | null;
    }[],
  ) {
    const sections: {
      teacher: { id: string; name: string };
      subject: string | null;
      card: Awaited<ReturnType<StudexaAcademicsService['reportCard']>>;
    }[] = [];
    for (const r of rosters) {
      try {
        const card = await this.academics.reportCard(
          { id: r.teacher.id },
          r.id,
        );
        sections.push({ teacher: r.teacher, subject: r.subject, card });
      } catch {
        // roster устсан/төлөв өөрчлөгдсөн — алгасна
      }
    }
    const pcts = sections
      .map((s) => s.card.percent)
      .filter((p): p is number => p !== null);
    const percent = pcts.length
      ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length)
      : null;
    return {
      sections,
      percent,
      letter: letterFor(percent, DEFAULT_GRADING_SCALE),
    };
  }

  /** Сурагчийн портал: мастер бүртгэлтэй холбогдсон бол ангийн нэгдсэн мэдээлэл */
  async portalSchool(user: AuthUser) {
    const pupil = await this.prisma.studexaPupil.findFirst({
      where: { userId: user.id, classId: { not: null } },
      include: {
        class: {
          include: {
            homeroomTeacher: { select: TEACHER_SELECT },
            teachers: {
              include: {
                teacher: { select: TEACHER_SELECT },
                subject: { select: { name: true } },
              },
            },
          },
        },
      },
    });
    if (!pupil?.class) return null;
    const cls = pupil.class;
    const rosters = await this.prisma.studexaStudent.findMany({
      where: { pupilId: pupil.id },
      include: { teacher: { select: TEACHER_SELECT } },
    });
    const subjectBy = new Map(
      cls.teachers.map((ct) => [ct.teacherId, ct.subject?.name ?? null]),
    );
    const rosterRows = rosters.map((r) => ({
      id: r.id,
      teacher: { id: r.teacher.id, name: teacherName(r.teacher) },
      subject: subjectBy.get(r.teacherId) ?? null,
    }));
    return {
      pupil: { id: pupil.id, name: pupil.name, status: pupil.status },
      class: { id: cls.id, name: cls.name, grade: cls.grade },
      homeroom: cls.homeroomTeacher
        ? {
            name: teacherName(cls.homeroomTeacher),
            code: cls.homeroomTeacher.code,
          }
        : null,
      teachers: cls.teachers.map((ct) => ({
        name: teacherName(ct.teacher),
        code: ct.teacher.code,
        subject: ct.subject?.name ?? null,
      })),
      report: await this.pupilReport(rosterRows),
      timetable: await this.classTimetable(cls),
    };
  }

  // ───────────────────────────── Roster синк

  /**
   * Ангийн багш бүр × идэвхтэй сурагч бүрд StudexaStudent (roster) мөр байгааг
   * баталгаажуулна. Багш тухайн акаунттай сурагчийг өмнө нь өөрөө бүртгэсэн бол
   * тэр мөрийг ангид нэгтгэнэ (давхар мөр үүсгэхгүй).
   */
  async ensureRosters(
    cls: { id: string; name: string },
    teacherIds?: string[],
    pupils?: (Profile & {
      id: string;
      userId: string | null;
      enrolled: string;
    })[],
  ) {
    const organizationId = OrgContext.require();
    const tIds =
      teacherIds ??
      (
        await this.prisma.studexaClassTeacher.findMany({
          where: { classId: cls.id },
          select: { teacherId: true },
        })
      ).map((x) => x.teacherId);
    const ps =
      pupils ??
      (await this.prisma.studexaPupil.findMany({
        where: { classId: cls.id, status: StudexaStudentStatus.ACTIVE },
      }));
    if (tIds.length === 0) return;
    for (const teacherId of tIds) {
      await this.prisma.studexaGroup.upsert({
        where: {
          organizationId_teacherId_name: {
            organizationId,
            teacherId,
            name: cls.name,
          },
        },
        create: { organizationId, teacherId, name: cls.name },
        update: {},
      });
    }
    if (ps.length === 0) return;
    const existing = await this.prisma.studexaStudent.findMany({
      where: { teacherId: { in: tIds }, pupilId: { in: ps.map((p) => p.id) } },
      select: { teacherId: true, pupilId: true },
    });
    const have = new Set(existing.map((e) => `${e.teacherId}|${e.pupilId}`));
    for (const teacherId of tIds) {
      for (const p of ps) {
        if (have.has(`${teacherId}|${p.id}`)) continue;
        const adopt = p.userId
          ? await this.prisma.studexaStudent.findFirst({
              where: { teacherId, userId: p.userId, pupilId: null },
              select: { id: true },
            })
          : null;
        if (adopt) {
          await this.prisma.studexaStudent.update({
            where: { id: adopt.id },
            data: { pupilId: p.id, group: cls.name, ...profileOf(p) },
          });
          continue;
        }
        await this.prisma.studexaStudent.create({
          data: {
            organizationId,
            teacherId,
            pupilId: p.id,
            userId: p.userId,
            group: cls.name,
            enrolled: p.enrolled,
            ...profileOf(p),
          },
        });
      }
    }
  }

  /** Мастерын профайл + акаунт бүх roster-т */
  private async propagate(
    pupil: Profile & { id: string; userId: string | null },
  ) {
    await this.prisma.studexaStudent.updateMany({
      where: { pupilId: pupil.id },
      data: { ...profileOf(pupil), userId: pupil.userId },
    });
  }

  /** Багш өөрийн roster-оо засахад мастер + бусад багшийн roster дагана */
  async syncFromRoster(pupilId: string, data: Profile) {
    const pupil = await this.prisma.studexaPupil.findFirst({
      where: { id: pupilId },
    });
    if (!pupil) return;
    const updated = await this.prisma.studexaPupil.update({
      where: { id: pupilId },
      data: profileOf(data),
    });
    await this.propagate(updated);
  }

  /** Roster мөрөнд ирц/оноо/даалгавар/төлбөр бүртгэгдээгүй бол «хоосон» */
  private async rosterIsEmpty(studentId: string): Promise<boolean> {
    const [a, g, h, p] = await Promise.all([
      this.prisma.studexaAttendanceRecord.count({ where: { studentId } }),
      this.prisma.studexaAssessment.count({ where: { studentId } }),
      this.prisma.studexaHomework.count({ where: { studentId } }),
      this.prisma.studexaPayment.count({ where: { studentId } }),
    ]);
    return a + g + h + p === 0;
  }

  /**
   * Акаунтыг мастер + бүх roster-т тархаана. Багш энэ акаунттай сурагчийг
   * ӨМНӨ НЬ өөрөө бүртгэсэн (ирц/дүнтэй) мөртэй бол автоматаар үүссэн хоосон
   * roster-ийг устгаж, тэр мөрийг ангид нэгтгэнэ — нэг багшид нэг сурагч
   * давхар гарахгүй, түүх алдагдахгүй.
   */
  async propagateUser(pupilId: string, userId: string) {
    const pupil = await this.prisma.studexaPupil.findFirst({
      where: { id: pupilId },
      include: { class: { select: { name: true } } },
    });
    if (!pupil) return;
    await this.prisma.studexaPupil.updateMany({
      where: { id: pupilId },
      data: { userId },
    });
    const rosters = await this.prisma.studexaStudent.findMany({
      where: { pupilId },
      select: { id: true, teacherId: true, userId: true, group: true },
    });
    for (const r of rosters) {
      if (r.userId === userId) continue;
      const existing = await this.prisma.studexaStudent.findFirst({
        where: { teacherId: r.teacherId, userId, pupilId: null },
        select: { id: true },
      });
      if (existing && (await this.rosterIsEmpty(r.id))) {
        await this.prisma.studexaStudent.delete({ where: { id: r.id } });
        await this.prisma.studexaStudent.update({
          where: { id: existing.id },
          data: {
            pupilId,
            group: pupil.class?.name ?? r.group,
            ...profileOf(pupil),
          },
        });
        continue;
      }
      await this.prisma.studexaStudent.update({
        where: { id: r.id },
        data: { userId },
      });
    }
  }
}
