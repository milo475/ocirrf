import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { StudexaHomeworkStatus } from '../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { OrgContext } from '../org/org-context';
import { PrismaService } from '../prisma/prisma.service';
import { discardUpload } from '../uploads/upload-cleanup.util';
import {
  HomeworkCreateDto,
  HomeworkGradeDto,
  HomeworkQueryDto,
  SubmitDto,
} from './dto/studexa.dto';
import { StudexaGradebookService } from './gradebook.service';
import { assertStudexaFile, fileUrlFor } from './studexa-files';
import { clip, shortDate, teacherGroups, todayStr } from './studexa.util';
import type { TeacherCtx } from './teacher.service';

type UploadedFile = { path: string; filename: string } | undefined;

function toInt(raw: string | undefined, top = 1000): number | null {
  if (raw === undefined || raw === null || String(raw).trim() === '')
    return null;
  const n = Number(String(raw).trim());
  if (!Number.isInteger(n)) return null;
  return Math.max(0, Math.min(top, n));
}

/**
 * ГЭРИЙН ДААЛГАВАР — Teams/Classroom загвар: нэг даалгавар (гарчиг +
 * эхлэх + дуусах огноо) = нэг багц, дотор нь сурагч бүрийн мөр, илгээлт,
 * оноо, төлөв. Оноо тавихад дүнгийн нэгтгэлд «Даалгавар N» багана
 * автоматаар үүснэ.
 */
@Injectable()
export class StudexaHomeworkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly gradebook: StudexaGradebookService,
  ) {}

  private async requireHomework(teacher: TeacherCtx, id: string) {
    const hw = await this.prisma.studexaHomework.findFirst({
      where: { id, student: { teacherId: teacher.id } },
      include: {
        student: { select: { id: true, name: true, userId: true } },
        submission: true,
      },
    });
    if (!hw) throw new NotFoundException('Даалгавар олдсонгүй');
    return hw;
  }

  async list(teacher: TeacherCtx, q: HomeworkQueryDto) {
    const status = q.status ?? '';
    const homeworks = await this.prisma.studexaHomework.findMany({
      where: {
        student: {
          teacherId: teacher.id,
          ...(q.group ? { group: q.group } : {}),
        },
        ...(status === 'open'
          ? { status: { not: StudexaHomeworkStatus.DONE } }
          : status
            ? { status: status as StudexaHomeworkStatus }
            : {}),
      },
      include: {
        student: { select: { id: true, name: true, group: true } },
        submission: true,
        gradeColumn: { select: { id: true, name: true, maxScore: true } },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 1000,
    });
    const today = todayStr();
    const index = new Map<string, any>();
    const groups: any[] = [];
    for (const hw of homeworks) {
      const key = `${hw.title}|${hw.date}|${hw.dueDate ?? ''}`;
      let g = index.get(key);
      if (!g) {
        g = {
          key,
          title: hw.title,
          date: hw.date,
          dueDate: hw.dueDate,
          attachmentUrl: hw.attachmentUrl,
          link: hw.link,
          gradeColumn: hw.gradeColumn,
          items: [],
        };
        index.set(key, g);
        groups.push(g);
      }
      if (hw.gradeColumn && !g.gradeColumn) g.gradeColumn = hw.gradeColumn;
      g.items.push(hw);
    }
    for (const g of groups) {
      g.total = g.items.length;
      g.submitted = g.items.filter((h: any) => h.submission).length;
      g.graded = g.items.filter((h: any) => h.score !== null).length;
      g.overdue = Boolean(
        g.dueDate &&
        g.dueDate < today &&
        g.items.some((h: any) => h.status !== StudexaHomeworkStatus.DONE),
      );
    }
    return {
      assignments: groups,
      status,
      group: q.group ?? '',
      groups: await teacherGroups(this.prisma, teacher.id),
      today,
    };
  }

  /** Даалгавар өгөх: бүгд / бүлэг / нэг сурагч. Хавсралт нэг л удаа хадгалагдана */
  async create(
    teacher: TeacherCtx,
    dto: HomeworkCreateDto,
    file: UploadedFile,
  ) {
    try {
      if (dto.dueDate < dto.date) {
        throw new BadRequestException(
          'Дуусах огноо эхлэх огнооноос өмнө байж болохгүй',
        );
      }
      let where: Record<string, unknown> = { teacherId: teacher.id };
      if (dto.target === 'all') {
        // бүх сурагч
      } else if (dto.target.startsWith('group:')) {
        where = { ...where, group: dto.target.slice(6) };
      } else {
        where = { ...where, id: dto.target };
      }
      const students = await this.prisma.studexaStudent.findMany({
        where,
        select: { id: true, userId: true },
      });
      if (students.length === 0) {
        throw new BadRequestException(
          'Энэ сонголтод сурагч алга — эхлээд сурагчаа нэмнэ үү',
        );
      }
      let attachmentUrl: string | null = null;
      if (file) {
        assertStudexaFile(file.path);
        attachmentUrl = fileUrlFor(file.filename);
      }
      const organizationId = OrgContext.require();
      const title = dto.title.trim();
      await this.prisma.studexaHomework.createMany({
        data: students.map((s) => ({
          organizationId,
          studentId: s.id,
          date: dto.date,
          dueDate: dto.dueDate,
          title,
          attachmentUrl,
          link: (dto.link ?? '').trim(),
        })),
      });
      const userIds = students
        .map((s) => s.userId)
        .filter((u): u is string => Boolean(u));
      if (userIds.length) {
        await this.notifications.notify(userIds, {
          type: 'STUDEXA_HOMEWORK',
          title: clip(
            `📘 Шинэ даалгавар: ${title.split('\n')[0]} (дуусах ${shortDate(dto.dueDate)})`,
            200,
          ),
          refType: 'studexa',
        });
      }
      return { ok: true, count: students.length };
    } catch (e) {
      await discardUpload(file);
      throw e;
    }
  }

  async setStatus(
    teacher: TeacherCtx,
    id: string,
    status: StudexaHomeworkStatus,
  ) {
    await this.requireHomework(teacher, id);
    await this.prisma.studexaHomework.update({
      where: { id },
      data: { status },
    });
    return { ok: true };
  }

  async remove(teacher: TeacherCtx, id: string) {
    await this.requireHomework(teacher, id);
    await this.prisma.studexaHomework.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Оноо тавих: «авсан / дээд». Хадгалахад нэгтгэлд «Даалгавар N» багана
   * автоматаар үүсч, ижил даалгаврын бүх сурагчийн оноо нэг баганад орно.
   * Хоосон оноо → нэгтгэл дэх оноог хамт устгаж, «Хийсэн» төлвийг буцаана.
   */
  async grade(teacher: TeacherCtx, id: string, dto: HomeworkGradeDto) {
    const hw = await this.requireHomework(teacher, id);
    const organizationId = OrgContext.require();
    const raw = (dto.score ?? '').trim();

    if (raw === '') {
      if (hw.gradeColumnId) {
        await this.prisma.studexaAssessment.deleteMany({
          where: { studentId: hw.studentId, columnId: hw.gradeColumnId },
        });
      }
      await this.prisma.studexaHomework.update({
        where: { id },
        data: {
          score: null,
          ...(hw.status === StudexaHomeworkStatus.DONE
            ? {
                status: hw.submission
                  ? StudexaHomeworkStatus.IN_PROGRESS
                  : StudexaHomeworkStatus.PENDING,
              }
            : {}),
        },
      });
      return { ok: true, score: null };
    }

    let earned = toInt(raw);
    if (earned === null)
      throw new BadRequestException('Оноо бүхэл тоо байх ёстой');

    // Багана: энэ даалгаврынх → ижил даалгаврын ангийнх → шинээр үүсгэх
    let column = hw.gradeColumnId
      ? await this.prisma.studexaGradeColumn.findUnique({
          where: { id: hw.gradeColumnId },
        })
      : null;
    if (!column) {
      const sibling = await this.prisma.studexaHomework.findFirst({
        where: {
          student: { teacherId: teacher.id },
          title: hw.title,
          date: hw.date,
          dueDate: hw.dueDate,
          gradeColumnId: { not: null },
        },
        include: { gradeColumn: true },
      });
      column = sibling?.gradeColumn ?? null;
    }
    const newMax = toInt(dto.maxScore);
    if (!column) {
      const n =
        (await this.prisma.studexaGradeColumn.count({
          where: { teacherId: teacher.id, name: { startsWith: 'Даалгавар ' } },
        })) + 1;
      const last = await this.prisma.studexaGradeColumn.findFirst({
        where: { teacherId: teacher.id },
        orderBy: { order: 'desc' },
      });
      column = await this.prisma.studexaGradeColumn.create({
        data: {
          organizationId,
          teacherId: teacher.id,
          name: `Даалгавар ${n}`,
          maxScore: newMax || 100,
          order: (last?.order ?? 0) + 1,
        },
      });
    } else if (newMax && newMax !== column.maxScore) {
      await this.gradebook.setColumnMax(column.id, newMax);
      column.maxScore = newMax;
    }

    // Ижил даалгаврын бүх мөрийг энэ баганатай холбоно
    await this.prisma.studexaHomework.updateMany({
      where: {
        student: { teacherId: teacher.id },
        title: hw.title,
        date: hw.date,
        dueDate: hw.dueDate,
      },
      data: { gradeColumnId: column.id },
    });

    earned = Math.min(earned, column.maxScore);
    const key = {
      organizationId,
      studentId: hw.studentId,
      columnId: column.id,
    };
    const existing = await this.prisma.studexaAssessment.findUnique({
      where: { organizationId_studentId_columnId: key },
    });
    if (!existing) {
      await this.prisma.studexaAssessment.create({
        data: { ...key, score: earned, date: todayStr() },
      });
    } else if (existing.score !== earned) {
      // Оноог дахин засахад анхны огноо хэвээр үлдэнэ (ахицын график хөдлөхгүй)
      await this.prisma.studexaAssessment.update({
        where: { id: existing.id },
        data: { score: earned },
      });
    }
    await this.prisma.studexaHomework.update({
      where: { id },
      data: { score: earned, status: StudexaHomeworkStatus.DONE },
    });
    if (hw.student.userId) {
      await this.notifications.notify([hw.student.userId], {
        type: 'STUDEXA_GRADED',
        title: clip(
          `⭐ «${hw.title.split('\n')[0].slice(0, 50)}» даалгаварт ${earned}/${column.maxScore} оноо орлоо`,
          200,
        ),
        refType: 'studexa',
        refId: id,
      });
    }
    return {
      ok: true,
      score: earned,
      maxScore: column.maxScore,
      columnId: column.id,
    };
  }

  // ───────────────────────────── Сурагчийн тал

  /** Сурагч даалгавраа файл/линкээр илгээнэ. Дахин илгээвэл шинэчилнэ */
  async submit(user: AuthUser, id: string, dto: SubmitDto, file: UploadedFile) {
    try {
      const hw = await this.prisma.studexaHomework.findFirst({
        where: { id, student: { userId: user.id } },
        include: {
          submission: true,
          student: {
            select: {
              id: true,
              name: true,
              teacher: { select: { userId: true } },
            },
          },
        },
      });
      if (!hw) throw new NotFoundException('Даалгавар олдсонгүй');
      const link = (dto.link ?? '').trim();
      if (!file && !link) {
        throw new BadRequestException(
          'Файл хавсаргах эсвэл линк оруулах шаардлагатай',
        );
      }
      if (link && !/^https?:\/\/\S+$/i.test(link)) {
        throw new BadRequestException(
          'Линк http:// эсвэл https:// -ээр эхлэх ёстой',
        );
      }
      let fileUrl: string | undefined;
      if (file) {
        assertStudexaFile(file.path);
        fileUrl = fileUrlFor(file.filename);
        // Хуучин файл дискэнд эзэнгүй үлдэхгүй
        if (hw.submission?.fileUrl) {
          await discardUpload({ path: this.pathOf(hw.submission.fileUrl) });
        }
      }
      const organizationId = OrgContext.require();
      const data = {
        ...(fileUrl ? { fileUrl } : {}),
        ...(link ? { link } : {}),
        comment: (dto.comment ?? '').trim(),
      };
      await this.prisma.studexaSubmission.upsert({
        where: { homeworkId: id },
        create: { organizationId, homeworkId: id, ...data },
        update: data,
      });
      // Илгээмэгц төлөв «Хийж буй» болно — багш шалгаад «Хийсэн» болгоно
      if (hw.status === StudexaHomeworkStatus.PENDING) {
        await this.prisma.studexaHomework.update({
          where: { id },
          data: { status: StudexaHomeworkStatus.IN_PROGRESS },
        });
      }
      await this.notifications.notify([hw.student.teacher.userId], {
        type: 'STUDEXA_SUBMITTED',
        title: clip(
          `📥 ${hw.student.name} «${hw.title.split('\n')[0].slice(0, 40)}» даалгавраа илгээлээ`,
          200,
        ),
        refType: 'studexa',
        refId: id,
      });
      return { ok: true };
    } catch (e) {
      await discardUpload(file);
      throw e;
    }
  }

  private pathOf(url: string): string {
    const name = url.split('/').pop() ?? '';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { join } = require('node:path') as typeof import('node:path');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { UPLOADS_DIR } =
      require('../uploads.config') as typeof import('../uploads.config');
    return join(UPLOADS_DIR, name);
  }

  /**
   * Файлд хандах эрх: даалгаврын хавсралт → тухайн багш эсвэл түүний
   * холбогдсон сурагчид; илгээсэн ажил → илгээсэн сурагч ба багш.
   */
  async canAccessFile(user: AuthUser, name: string): Promise<boolean> {
    if (user.isSuperAdmin) return true;
    const url = fileUrlFor(name);
    const [hw, sub] = await Promise.all([
      this.prisma.studexaHomework.findFirst({
        where: {
          attachmentUrl: url,
          OR: [
            { student: { teacher: { userId: user.id } } },
            { student: { userId: user.id } },
          ],
        },
        select: { id: true },
      }),
      this.prisma.studexaSubmission.findFirst({
        where: {
          fileUrl: url,
          OR: [
            { homework: { student: { teacher: { userId: user.id } } } },
            { homework: { student: { userId: user.id } } },
          ],
        },
        select: { id: true },
      }),
    ]);
    if (hw || sub) return true;
    throw new ForbiddenException('Энэ файлд хандах эрхгүй');
  }
}
