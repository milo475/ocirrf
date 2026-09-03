import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrgContext } from '../org/org-context';
import { PrismaService } from '../prisma/prisma.service';
import { ColumnCreateDto, GradebookSaveDto } from './dto/studexa.dto';
import { buildClassTable, buildCsv, todayStr } from './studexa.util';
import type { TeacherCtx } from './teacher.service';

function toScore(raw: string | undefined, top = 100): number | null {
  if (raw === undefined || raw === null || String(raw).trim() === '')
    return null;
  const n = Number(String(raw).trim());
  if (!Number.isInteger(n)) return null;
  return Math.max(0, Math.min(top, n));
}

/**
 * ДҮНГИЙН НЭГТГЭЛ — Excel шиг шууд засах горим (Studexa gradebook).
 * Багана бүр нэр + дээд оноотой; нүд бүр нэг сурагчийн нэг баганын оноо.
 */
@Injectable()
export class StudexaGradebookService {
  constructor(private readonly prisma: PrismaService) {}

  private columns(teacherId: string) {
    return this.prisma.studexaGradeColumn.findMany({
      where: { teacherId },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    });
  }

  async get(teacher: TeacherCtx, group?: string) {
    const [students, columns] = await Promise.all([
      this.prisma.studexaStudent.findMany({
        where: { teacherId: teacher.id, ...(group ? { group } : {}) },
        select: {
          id: true,
          name: true,
          group: true,
          attendance: true,
          hwPercent: true,
        },
        orderBy: [{ group: 'asc' }, { name: 'asc' }],
      }),
      this.columns(teacher.id),
    ]);
    const ids = students.map((s) => s.id);
    const [assessments, withRecords] = await Promise.all([
      ids.length
        ? this.prisma.studexaAssessment.findMany({
            where: { studentId: { in: ids } },
          })
        : [],
      ids.length
        ? this.prisma.studexaAttendanceRecord.findMany({
            where: { studentId: { in: ids } },
            select: { studentId: true },
            distinct: ['studentId'],
          })
        : Promise.resolve([] as { studentId: string }[]),
    ]);
    const hasRecords = new Set(withRecords.map((r) => r.studentId));
    const scores = new Map<string, number>();
    for (const a of assessments)
      scores.set(`${a.studentId}|${a.columnId}`, a.score);
    return {
      group: group ?? '',
      columns: columns.map((c) => ({
        id: c.id,
        name: c.name,
        maxScore: c.maxScore,
      })),
      rows: students.map((s) => ({
        student: { id: s.id, name: s.name, group: s.group },
        att: s.attendance,
        // Ирцийн бүртгэлтэй сурагчийн ирц автоматаар тооцогддог — гараар засахгүй
        attAuto: hasRecords.has(s.id),
        hw: s.hwPercent,
        cells: columns.map((c) => ({
          columnId: c.id,
          value: scores.get(`${s.id}|${c.id}`) ?? null,
          max: c.maxScore,
        })),
      })),
    };
  }

  /**
   * Баганын дээд оноог өөрчилнө. Багасгахад аль хэдийн тавигдсан оноонууд
   * шинэ дээд оноог хэтрэхгүй байхаар хумигдана (18/10 мэт зөрчил үүсэхгүй).
   */
  async setColumnMax(columnId: string, maxScore: number) {
    await this.prisma.studexaGradeColumn.update({
      where: { id: columnId },
      data: { maxScore },
    });
    await this.prisma.studexaAssessment.updateMany({
      where: { columnId, score: { gt: maxScore } },
      data: { score: maxScore },
    });
    await this.prisma.studexaHomework.updateMany({
      where: { gradeColumnId: columnId, score: { gt: maxScore } },
      data: { score: maxScore },
    });
  }

  async save(
    teacher: TeacherCtx,
    group: string | undefined,
    dto: GradebookSaveDto,
  ) {
    const organizationId = OrgContext.require();
    const columns = await this.columns(teacher.id);
    const colById = new Map(columns.map((c) => [c.id, c]));
    const students = await this.prisma.studexaStudent.findMany({
      where: { teacherId: teacher.id, ...(group ? { group } : {}) },
      select: { id: true, attendance: true, hwPercent: true },
    });
    const stuById = new Map(students.map((s) => [s.id, s]));
    let changed = 0;

    // 1. Баганын нэр / дээд оноо
    for (const edit of dto.columns ?? []) {
      const col = colById.get(edit.id);
      if (!col) continue;
      const name = edit.name?.trim();
      if (name && name !== col.name) {
        await this.prisma.studexaGradeColumn.update({
          where: { id: col.id },
          data: { name },
        });
        col.name = name;
        changed++;
      }
      if (edit.maxScore && edit.maxScore !== col.maxScore) {
        await this.setColumnMax(col.id, edit.maxScore);
        col.maxScore = edit.maxScore;
        changed++;
      }
    }

    // 2. Оноонууд
    const today = todayStr();
    for (const cell of dto.cells ?? []) {
      const col = colById.get(cell.columnId);
      if (!col || !stuById.has(cell.studentId)) continue;
      const key = {
        organizationId,
        studentId: cell.studentId,
        columnId: col.id,
      };
      if (
        cell.value === undefined ||
        cell.value === null ||
        String(cell.value).trim() === ''
      ) {
        const res = await this.prisma.studexaAssessment.deleteMany({
          where: { studentId: cell.studentId, columnId: col.id },
        });
        changed += res.count;
        continue;
      }
      const score = toScore(cell.value, col.maxScore);
      if (score === null) continue;
      const existing = await this.prisma.studexaAssessment.findUnique({
        where: { organizationId_studentId_columnId: key },
      });
      if (!existing) {
        await this.prisma.studexaAssessment.create({
          data: { ...key, date: today, score },
        });
        changed++;
      } else if (existing.score !== score) {
        await this.prisma.studexaAssessment.update({
          where: { id: existing.id },
          data: { score },
        });
        changed++;
      }
    }

    // 3. Ирц (гараар) — зөвхөн ирцийн бүртгэлгүй сурагчид
    const withRecords = new Set(
      (
        await this.prisma.studexaAttendanceRecord.findMany({
          where: { studentId: { in: [...stuById.keys()] } },
          select: { studentId: true },
          distinct: ['studentId'],
        })
      ).map((r) => r.studentId),
    );
    for (const a of dto.attendance ?? []) {
      const s = stuById.get(a.studentId);
      const v = toScore(a.value);
      if (!s || v === null || withRecords.has(s.id) || v === s.attendance)
        continue;
      await this.prisma.studexaStudent.update({
        where: { id: s.id },
        data: { attendance: v },
      });
      changed++;
    }

    // 4. Даалгаврын хувь (гараар; хоосон → автомат)
    for (const h of dto.hwPercent ?? []) {
      const s = stuById.get(h.studentId);
      if (!s) continue;
      const v =
        h.value === undefined ||
        h.value === null ||
        String(h.value).trim() === ''
          ? null
          : toScore(h.value);
      if (v === (s.hwPercent ?? null)) continue;
      await this.prisma.studexaStudent.update({
        where: { id: s.id },
        data: { hwPercent: v },
      });
      changed++;
    }

    return { ok: true, changed };
  }

  async createColumn(teacher: TeacherCtx, dto: ColumnCreateDto) {
    const last = await this.prisma.studexaGradeColumn.findFirst({
      where: { teacherId: teacher.id },
      orderBy: { order: 'desc' },
    });
    return this.prisma.studexaGradeColumn.create({
      data: {
        organizationId: OrgContext.require(),
        teacherId: teacher.id,
        name: dto.name.trim(),
        maxScore: dto.maxScore ?? 100,
        order: (last?.order ?? 0) + 1,
      },
    });
  }

  async deleteColumn(teacher: TeacherCtx, id: string) {
    const res = await this.prisma.studexaGradeColumn.deleteMany({
      where: { id, teacherId: teacher.id },
    });
    if (res.count === 0) throw new NotFoundException('Багана олдсонгүй');
    return { ok: true };
  }

  /** Дүнгийн нэгтгэл — UTF-8 BOM CSV (платформын тайлангийн стандарт) */
  async exportCsv(teacher: TeacherCtx, group?: string): Promise<string> {
    const students = await this.prisma.studexaStudent.findMany({
      where: { teacherId: teacher.id, ...(group ? { group } : {}) },
      select: {
        id: true,
        name: true,
        group: true,
        attendance: true,
        hwPercent: true,
      },
      orderBy: [{ group: 'asc' }, { name: 'asc' }],
    });
    const table = await buildClassTable(this.prisma, teacher.id, students);
    const headers = [
      'Сурагчийн нэр',
      'Бүлэг',
      'Ирц',
      'Гэрийн даалгавар',
      ...table.colLabels,
      'Нийт оноо',
    ];
    const rows = table.rows.map((r) => [
      r.student.name,
      r.student.group || '—',
      r.att,
      r.hw,
      ...r.cells.map((c) => (c === '' ? '' : c)),
      r.grandLabel,
    ]);
    if (rows.length === 0)
      throw new BadRequestException('Экспортлох сурагч алга');
    return buildCsv(headers, rows);
  }
}
