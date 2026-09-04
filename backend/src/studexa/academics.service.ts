import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StudexaGender } from '../generated/prisma/client';
import { OrgContext } from '../org/org-context';
import { PrismaService } from '../prisma/prisma.service';
import {
  GradingScaleDto,
  StudentNoteDto,
  SubjectDto,
  TermDto,
} from './dto/studexa.dto';
import {
  buildClassTable,
  canonicalGroupName,
  DEFAULT_GRADING_SCALE,
  effectiveAttendances,
  groupNameError,
  isValidDateStr,
  letterFor,
  normalizeScale,
  todayStr,
} from './studexa.util';
import type { TeacherCtx } from './teacher.service';

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    (e as { code?: string }).code === 'P2002'
  );
}

/**
 * СУРГУУЛИЙН НЭМЭЛТҮҮД (Studexa): хичээл (судлагдахуун), улирал, үнэлгээний
 * хуваарь, дүнгийн хуудас, сурагчийн тэмдэглэл, CSV импорт.
 */
@Injectable()
export class StudexaAcademicsService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────── Хичээл (судлагдахуун)

  subjects(teacher: TeacherCtx) {
    return this.prisma.studexaSubject.findMany({
      where: { teacherId: teacher.id },
      orderBy: { name: 'asc' },
      include: { _count: { select: { lessons: true, columns: true } } },
    });
  }

  async createSubject(teacher: TeacherCtx, dto: SubjectDto) {
    try {
      return await this.prisma.studexaSubject.create({
        data: {
          organizationId: OrgContext.require(),
          teacherId: teacher.id,
          name: dto.name.trim(),
          color: dto.color ?? 'indigo',
        },
      });
    } catch (e) {
      if (isUniqueViolation(e))
        throw new ConflictException('Ийм нэртэй хичээл аль хэдийн байна');
      throw e;
    }
  }

  async updateSubject(teacher: TeacherCtx, id: string, dto: SubjectDto) {
    const s = await this.prisma.studexaSubject.findFirst({
      where: { id, teacherId: teacher.id },
    });
    if (!s) throw new NotFoundException('Хичээл олдсонгүй');
    try {
      return await this.prisma.studexaSubject.update({
        where: { id },
        data: { name: dto.name.trim(), color: dto.color ?? s.color },
      });
    } catch (e) {
      if (isUniqueViolation(e))
        throw new ConflictException('Ийм нэртэй хичээл аль хэдийн байна');
      throw e;
    }
  }

  /** Устгахад хуваарь/багана хичээлгүй болно (SetNull) — өгөгдөл алдагдахгүй */
  async deleteSubject(teacher: TeacherCtx, id: string) {
    const res = await this.prisma.studexaSubject.deleteMany({
      where: { id, teacherId: teacher.id },
    });
    if (res.count === 0) throw new NotFoundException('Хичээл олдсонгүй');
    return { ok: true };
  }

  // ───────────────────────────── Улирал

  terms(teacher: TeacherCtx) {
    return this.prisma.studexaTerm.findMany({
      where: { teacherId: teacher.id },
      orderBy: { startDate: 'desc' },
      include: { _count: { select: { columns: true } } },
    });
  }

  private checkTerm(dto: TermDto) {
    if (dto.endDate < dto.startDate)
      throw new BadRequestException(
        'Дуусах огноо эхлэх огнооноос өмнө байж болохгүй',
      );
  }

  async createTerm(teacher: TeacherCtx, dto: TermDto) {
    this.checkTerm(dto);
    const count = await this.prisma.studexaTerm.count({
      where: { teacherId: teacher.id },
    });
    return this.prisma.studexaTerm.create({
      data: {
        organizationId: OrgContext.require(),
        teacherId: teacher.id,
        name: dto.name.trim(),
        startDate: dto.startDate,
        endDate: dto.endDate,
        // Анхны улирал автоматаар идэвхтэй
        isCurrent: count === 0,
      },
    });
  }

  async updateTerm(teacher: TeacherCtx, id: string, dto: TermDto) {
    this.checkTerm(dto);
    const res = await this.prisma.studexaTerm.updateMany({
      where: { id, teacherId: teacher.id },
      data: {
        name: dto.name.trim(),
        startDate: dto.startDate,
        endDate: dto.endDate,
      },
    });
    if (res.count === 0) throw new NotFoundException('Улирал олдсонгүй');
    return this.prisma.studexaTerm.findUnique({ where: { id } });
  }

  async setCurrentTerm(teacher: TeacherCtx, id: string) {
    const t = await this.prisma.studexaTerm.findFirst({
      where: { id, teacherId: teacher.id },
    });
    if (!t) throw new NotFoundException('Улирал олдсонгүй');
    await this.prisma.$transaction([
      this.prisma.studexaTerm.updateMany({
        where: { teacherId: teacher.id, isCurrent: true },
        data: { isCurrent: false },
      }),
      this.prisma.studexaTerm.update({
        where: { id },
        data: { isCurrent: true },
      }),
    ]);
    return { ok: true };
  }

  async deleteTerm(teacher: TeacherCtx, id: string) {
    const res = await this.prisma.studexaTerm.deleteMany({
      where: { id, teacherId: teacher.id },
    });
    if (res.count === 0) throw new NotFoundException('Улирал олдсонгүй');
    return { ok: true };
  }

  /** Одоогийн улирал (isCurrent, эс бол өнөөдрийг агуулах, эс бол хамгийн сүүлийнх) */
  async currentTerm(teacherId: string) {
    const terms = await this.prisma.studexaTerm.findMany({
      where: { teacherId },
      orderBy: { startDate: 'desc' },
    });
    const today = todayStr();
    return (
      terms.find((t) => t.isCurrent) ??
      terms.find((t) => t.startDate <= today && today <= t.endDate) ??
      terms[0] ??
      null
    );
  }

  // ───────────────────────────── Үнэлгээний хуваарь

  async gradingScale(teacher: TeacherCtx) {
    const t = await this.prisma.studexaTeacher.findUnique({
      where: { id: teacher.id },
      select: { gradingScale: true },
    });
    return {
      scale: normalizeScale(t?.gradingScale),
      isDefault: !t?.gradingScale,
      defaultScale: DEFAULT_GRADING_SCALE,
    };
  }

  async setGradingScale(teacher: TeacherCtx, dto: GradingScaleDto) {
    const scale = normalizeScale(dto.scale);
    const labels = new Set(scale.map((s) => s.label));
    if (labels.size !== scale.length)
      throw new BadRequestException('Үнэлгээний шошго давхардаж байна');
    await this.prisma.studexaTeacher.update({
      where: { id: teacher.id },
      data: { gradingScale: scale },
    });
    return { scale, isDefault: false };
  }

  async resetGradingScale(teacher: TeacherCtx) {
    await this.prisma.studexaTeacher.update({
      where: { id: teacher.id },
      data: { gradingScale: null as never },
    });
    return { scale: DEFAULT_GRADING_SCALE, isDefault: true };
  }

  // ───────────────────────────── Сурагчийн тэмдэглэл

  private async requireStudent(teacher: TeacherCtx, studentId: string) {
    const s = await this.prisma.studexaStudent.findFirst({
      where: { id: studentId, teacherId: teacher.id },
    });
    if (!s) throw new NotFoundException('Сурагч олдсонгүй');
    return s;
  }

  async studentNotes(teacher: TeacherCtx, studentId: string) {
    await this.requireStudent(teacher, studentId);
    return this.prisma.studexaStudentNote.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async addStudentNote(
    teacher: TeacherCtx,
    studentId: string,
    dto: StudentNoteDto,
  ) {
    await this.requireStudent(teacher, studentId);
    return this.prisma.studexaStudentNote.create({
      data: {
        organizationId: OrgContext.require(),
        studentId,
        text: dto.text.trim(),
      },
    });
  }

  async deleteStudentNote(teacher: TeacherCtx, studentId: string, id: string) {
    await this.requireStudent(teacher, studentId);
    await this.prisma.studexaStudentNote.deleteMany({
      where: { id, studentId },
    });
    return { ok: true };
  }

  // ───────────────────────────── Дүнгийн хуудас

  /**
   * Сурагчийн улирлын дүнгийн хуудас: хичээл бүрээр оноо (багана бүр),
   * нийт хувь + үсгэн үнэлгээ, улирлын ирц, ангийн эрэмбэ, даалгаврын гүйцэтгэл.
   * termId өгөхгүй бол одоогийн улирал; улирал огт байхгүй бол бүх багана.
   */
  async reportCard(
    teacher: { id: string; gradingScale?: unknown },
    studentId: string,
    termId?: string,
  ) {
    const student = await this.prisma.studexaStudent.findFirst({
      where: { id: studentId, teacherId: teacher.id },
      select: {
        id: true,
        name: true,
        group: true,
        registerNo: true,
        birthDate: true,
        gender: true,
        status: true,
        enrolled: true,
      },
    });
    if (!student) throw new NotFoundException('Сурагч олдсонгүй');
    const t = await this.prisma.studexaTeacher.findUnique({
      where: { id: teacher.id },
      select: { gradingScale: true, user: { select: { fullName: true } } },
    });
    const scale = normalizeScale(t?.gradingScale);
    const term = termId
      ? await this.prisma.studexaTerm.findFirst({
          where: { id: termId, teacherId: teacher.id },
        })
      : await this.currentTerm(teacher.id);
    if (termId && !term) throw new NotFoundException('Улирал олдсонгүй');

    const columns = await this.prisma.studexaGradeColumn.findMany({
      where: { teacherId: teacher.id, ...(term ? { termId: term.id } : {}) },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
      include: { subject: { select: { id: true, name: true } } },
    });
    const assessments = await this.prisma.studexaAssessment.findMany({
      where: { studentId, columnId: { in: columns.map((c) => c.id) } },
    });
    const scoreBy = new Map(assessments.map((a) => [a.columnId, a]));

    // Хичээлээр бүлэглэнэ (хичээлгүй багана → «Бусад»)
    type Row = {
      column: string;
      score: number | null;
      max: number;
      percent: number | null;
      date: string | null;
    };
    const bySubject = new Map<
      string,
      { subject: string; rows: Row[]; earned: number; possible: number }
    >();
    let earned = 0;
    let possible = 0;
    for (const c of columns) {
      const key = c.subject?.id ?? '__other__';
      if (!bySubject.has(key))
        bySubject.set(key, {
          subject: c.subject?.name ?? 'Бусад',
          rows: [],
          earned: 0,
          possible: 0,
        });
      const g = bySubject.get(key)!;
      const a = scoreBy.get(c.id);
      g.rows.push({
        column: c.name,
        score: a?.score ?? null,
        max: c.maxScore,
        percent: a ? Math.round((100 * a.score) / c.maxScore) : null,
        date: a?.date ?? null,
      });
      if (a) {
        g.earned += a.score;
        g.possible += c.maxScore;
        earned += a.score;
        possible += c.maxScore;
      }
    }
    const subjects = [...bySubject.values()].map((g) => {
      const pct = g.possible ? Math.round((100 * g.earned) / g.possible) : null;
      return { ...g, percent: pct, letter: letterFor(pct, scale) };
    });
    const percent = possible ? Math.round((100 * earned) / possible) : null;

    // Улирлын ирц
    const atts = effectiveAttendances(
      await this.prisma.studexaAttendanceRecord.findMany({
        where: {
          studentId,
          ...(term ? { date: { gte: term.startDate, lte: term.endDate } } : {}),
        },
        select: { date: true, lessonId: true, status: true },
      }),
    );
    const present = atts.filter((a) => a.status === 'PRESENT').length;
    const late = atts.filter((a) => a.status === 'LATE').length;
    const absent = atts.filter((a) => a.status === 'ABSENT').length;

    // Даалгавар (улирлын огноогоор)
    const hws = await this.prisma.studexaHomework.findMany({
      where: {
        studentId,
        ...(term ? { date: { gte: term.startDate, lte: term.endDate } } : {}),
      },
      select: { status: true },
    });

    // Ангийн эрэмбэ (бүлгийнхээ дотор, ижил улирлаар)
    let rank: number | null = null;
    let classSize = 0;
    if (student.group) {
      const mates = await this.prisma.studexaStudent.findMany({
        where: {
          teacherId: teacher.id,
          group: student.group,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          name: true,
          group: true,
          attendance: true,
          hwPercent: true,
        },
      });
      const table = await buildClassTable(this.prisma, teacher.id, mates, {
        termId: term?.id,
        scale,
      });
      classSize = table.rows.filter((r) => r.grand !== null).length;
      rank = table.rows.find((r) => r.student.id === studentId)?.rank ?? null;
    }

    return {
      student,
      teacherName: t?.user.fullName ?? '',
      term: term
        ? {
            id: term.id,
            name: term.name,
            startDate: term.startDate,
            endDate: term.endDate,
          }
        : null,
      subjects,
      earned,
      possible,
      percent,
      letter: letterFor(percent, scale),
      scale,
      attendance: {
        present,
        late,
        absent,
        total: atts.length,
        percent: atts.length
          ? Math.round((100 * (present + late)) / atts.length)
          : null,
      },
      homework: {
        total: hws.length,
        done: hws.filter((h) => h.status === 'DONE').length,
      },
      rank,
      classSize,
      generatedAt: todayStr(),
    };
  }

  // ───────────────────────────── CSV импорт

  /**
   * Сурагчдыг CSV-ээс бөөнөөр нэмнэ. Толгойн мөр монгол/англи аль ч нэртэй
   * байж болно; хуваагч нь `,` эсвэл `;` (автоматаар таньна), UTF-8 BOM зөвшөөрнө.
   * Талбар: нэр*, бүлэг, утас, аавын нэр, аавын утас, ээжийн нэр, ээжийн утас,
   * төрсөн огноо (YYYY-MM-DD), хүйс (эр/эм), регистр, хаяг.
   */
  async importCsv(teacher: TeacherCtx, buffer: Buffer) {
    const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
    const lines = parseCsv(text);
    if (lines.length < 2)
      throw new BadRequestException(
        'CSV-д толгойн мөр + дор хаяж нэг сурагчийн мөр байх ёстой',
      );
    const header = lines[0].map((h) => h.trim().toLowerCase());
    const col = (names: string[]) => {
      const i = header.findIndex((h) => names.includes(h));
      return i >= 0 ? i : -1;
    };
    const idx = {
      name: col(['name', 'нэр', 'сурагчийн нэр']),
      group: col(['group', 'бүлэг', 'анги']),
      phone: col(['phone', 'утас', 'сурагчийн утас']),
      fatherName: col(['fathername', 'father_name', 'аавын нэр']),
      fatherPhone: col([
        'fatherphone',
        'father_phone',
        'аавын утас',
        'аавын утасны дугаар',
      ]),
      motherName: col(['mothername', 'mother_name', 'ээжийн нэр']),
      motherPhone: col([
        'motherphone',
        'mother_phone',
        'ээжийн утас',
        'ээжийн утасны дугаар',
      ]),
      birthDate: col(['birthdate', 'birth_date', 'төрсөн огноо']),
      gender: col(['gender', 'хүйс']),
      registerNo: col([
        'registerno',
        'register_no',
        'регистр',
        'регистрийн дугаар',
      ]),
      address: col(['address', 'хаяг']),
    };
    if (idx.name < 0)
      throw new BadRequestException(
        'Толгойн мөрөнд «нэр» (name) багана байх ёстой',
      );

    const organizationId = OrgContext.require();
    const groupCache = new Map<string, string>();
    const created: string[] = [];
    const skipped: { line: number; reason: string }[] = [];
    const get = (row: string[], i: number) =>
      i >= 0 ? (row[i] ?? '').trim() : '';

    for (let n = 1; n < lines.length; n++) {
      const row = lines[n];
      if (row.every((c) => !c.trim())) continue;
      const name = get(row, idx.name);
      if (!name) {
        skipped.push({ line: n + 1, reason: 'Нэр хоосон' });
        continue;
      }
      let group = get(row, idx.group);
      if (group) {
        const err = groupNameError(group);
        if (err) {
          skipped.push({ line: n + 1, reason: err });
          continue;
        }
        if (!groupCache.has(group))
          groupCache.set(
            group,
            await canonicalGroupName(this.prisma, teacher.id, group),
          );
        group = groupCache.get(group)!;
      }
      const birthDate = get(row, idx.birthDate);
      if (birthDate && !isValidDateStr(birthDate)) {
        skipped.push({
          line: n + 1,
          reason: `Төрсөн огноо буруу (YYYY-MM-DD): ${get(row, idx.birthDate)}`,
        });
        continue;
      }
      const g = get(row, idx.gender).toLowerCase();
      const gender = ['эр', 'эрэгтэй', 'male', 'm', 'э'].includes(g)
        ? StudexaGender.MALE
        : ['эм', 'эмэгтэй', 'female', 'f'].includes(g)
          ? StudexaGender.FEMALE
          : null;
      await this.prisma.studexaStudent.create({
        data: {
          organizationId,
          teacherId: teacher.id,
          name: name.slice(0, 100),
          group,
          enrolled: todayStr(),
          phone: get(row, idx.phone).slice(0, 20),
          fatherName: get(row, idx.fatherName).slice(0, 100),
          fatherPhone: get(row, idx.fatherPhone).slice(0, 20),
          motherName: get(row, idx.motherName).slice(0, 100),
          motherPhone: get(row, idx.motherPhone).slice(0, 20),
          birthDate: birthDate || null,
          gender,
          registerNo: get(row, idx.registerNo).slice(0, 30),
          address: get(row, idx.address).slice(0, 200),
        },
      });
      created.push(name);
    }
    return { created: created.length, names: created.slice(0, 50), skipped };
  }
}

/** Энгийн CSV parser: хашилт, хашилт доторх хуваагч/мөр, `,`/`;` хуваагч */
export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/)[0] ?? '';
  const delim =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0)
      ? ';'
      : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delim) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
