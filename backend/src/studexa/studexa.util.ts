import { escape } from 'node:querystring';
import type { PrismaService } from '../prisma/prisma.service';
import {
  StudexaAttendanceStatus,
  StudexaMonthPayState,
  StudexaPayState,
  StudexaSchoolType,
} from '../generated/prisma/client';

/**
 * STUDEXA — нийтлэг туслахууд. Django Studexa-гийн models.py/views.py дэх
 * тооцооллын нэг л томьёог (ирцийн хувь, дүнгийн хүснэгт, ангийн нэгтгэл,
 * хуваарийн тор, график) энд төвлөрүүлсэн: багшийн хуудас, сурагчийн
 * портал, экспорт бүгд ИЖИЛ тоо харуулна.
 */

export const DAY_START = 7; // хуваарийн эхлэх цаг
export const DAY_END = 23; // хуваарийн дуусах цаг

export const WEEKDAYS = [
  'Даваа',
  'Мягмар',
  'Лхагва',
  'Пүрэв',
  'Баасан',
  'Бямба',
  'Ням',
];

/** Сургуулийн төрөл бүрд системээс олгох багшийн кодын угтвар */
export const TEACHER_CODE_PREFIXES: Partial<Record<StudexaSchoolType, string>> =
  {
    [StudexaSchoolType.SCHOOL]: 'trt',
    [StudexaSchoolType.ACADEMY]: 'stdx',
    [StudexaSchoolType.PRIVATE]: 'stu',
  };

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Өнөөдрийн огноо Улаанбаатарын цагаар — YYYY-MM-DD */
export function todayStr(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ulaanbaatar',
  }).format(new Date());
}

/** YYYY-MM-DD → гараг (0=Даваа … 6=Ням) */
export function weekdayOf(date: string): number {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0=Ням
  return (d + 6) % 7;
}

/** YYYY-MM-DD дээр n хоног нэмнэ/хасна */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** MM.DD хэлбэрийн богино шошго */
export function shortDate(date: string): string {
  return `${date.slice(5, 7)}.${date.slice(8, 10)}`;
}

/** Урт текстийг хумина (мэдэгдлийн гарчиг г.м.) */
export function clip(text: string, limit: number): string {
  const t = text ?? '';
  return t.length <= limit ? t : t.slice(0, limit - 1) + '…';
}

export const GROUP_NAME_MAX = 100;

/** Бүлгийн нэр буруу бол алдааны шалтгаан, зөв бол null */
export function groupNameError(name: string): string | null {
  if (!name || !name.trim()) return 'Бүлгийн нэр хоосон байж болохгүй';
  if (name.includes('/') || name.includes('\\'))
    return 'Бүлгийн нэрэнд "/" тэмдэгт ашиглах боломжгүй';
  if (name.trim() === '.' || name.trim() === '..')
    return 'Бүлгийн нэр "." эсвэл ".." байж болохгүй';
  if (name.length > GROUP_NAME_MAX)
    return `Бүлгийн нэр ${GROUP_NAME_MAX} тэмдэгтээс урт байж болохгүй`;
  return null;
}

/**
 * «10а» ба «10А» мэт том/жижиг үсгээр л ялгаатай давхар бүлэг үүсэхээс
 * сэргийлнэ: багшид ижил нэртэй бүлэг байвал түүний бичиглэлийг буцаана.
 */
export async function canonicalGroupName(
  prisma: PrismaService,
  teacherId: string,
  name: string,
): Promise<string> {
  if (!name) return name;
  const target = name.toLocaleLowerCase();
  const [fromStudents, fromGroups] = await Promise.all([
    prisma.studexaStudent.findMany({
      where: { teacherId, group: { not: '' } },
      select: { group: true },
      distinct: ['group'],
    }),
    prisma.studexaGroup.findMany({
      where: { teacherId },
      select: { name: true },
    }),
  ]);
  const existing = new Set([
    ...fromStudents.map((s) => s.group),
    ...fromGroups.map((g) => g.name),
  ]);
  for (const g of existing) {
    if (g.toLocaleLowerCase() === target) return g;
  }
  return name;
}

/** Багшийн бүх бүлгийн нэрс (сурагчтай + хоосон + хичээлтэй), эрэмбэтэй */
export async function teacherGroups(
  prisma: PrismaService,
  teacherId: string,
  opts: { lessons?: boolean } = {},
): Promise<string[]> {
  const [students, groups, lessons] = await Promise.all([
    prisma.studexaStudent.findMany({
      where: { teacherId, group: { not: '' } },
      select: { group: true },
      distinct: ['group'],
    }),
    prisma.studexaGroup.findMany({
      where: { teacherId },
      select: { name: true },
    }),
    opts.lessons
      ? prisma.studexaLesson.findMany({
          where: { teacherId, group: { not: '' } },
          select: { group: true },
          distinct: ['group'],
        })
      : Promise.resolve([] as { group: string }[]),
  ]);
  const set = new Set<string>([
    ...students.map((s) => s.group),
    ...groups.map((g) => g.name),
    ...lessons.map((l) => l.group),
  ]);
  return [...set].sort((a, b) => a.localeCompare(b));
}

// ───────────────────────────────────────────── Ирц

type AttRow = {
  date: string;
  lessonId: string | null;
  status: StudexaAttendanceStatus;
};

/**
 * Тооцоонд орох ирцийн бүртгэлүүд. Тухайн өдөр хичээлийн ирц бүртгэгдсэн
 * бол өдрийн ерөнхий (lessonId=null) бүртгэл давхардуулж тоологдохгүй.
 */
export function effectiveAttendances<T extends AttRow>(rows: T[]): T[] {
  const lessonDates = new Set(
    rows.filter((r) => r.lessonId).map((r) => r.date),
  );
  return rows.filter((r) => r.lessonId || !lessonDates.has(r.date));
}

/**
 * Сурагчийн ирцийн статистикийг бүртгэлээс дахин тооцно. «Ирсэн» ба
 * «Хоцорсон» хоёулаа ирсэнд тооцогдоно — системийн бүх хуудас энэ нэг томьёо.
 * Бүртгэл бүгд устсан бол анхны төлөвт (100 / 0 / 0) буцаана.
 */
export async function recalcAttendance(
  prisma: PrismaService,
  studentId: string,
) {
  const rows = await prisma.studexaAttendanceRecord.findMany({
    where: { studentId },
    select: { date: true, lessonId: true, status: true },
  });
  const atts = effectiveAttendances(rows);
  const total = atts.length;
  const attended = atts.filter(
    (a) => a.status !== StudexaAttendanceStatus.ABSENT,
  ).length;
  await prisma.studexaStudent.update({
    where: { id: studentId },
    data: {
      totalLessons: total,
      attendedLessons: attended,
      attendance: total ? Math.round((100 * attended) / total) : 100,
    },
  });
}

/** Сарын төлбөрийн бүртгэлээс ерөнхий төлөв: аль нэг сар хоцорсон бол хоцорсон */
export async function syncPaymentStatus(
  prisma: PrismaService,
  studentId: string,
) {
  const statuses = await prisma.studexaPayment.findMany({
    where: { studentId },
    select: { status: true },
  });
  if (statuses.length === 0) return;
  const status = statuses.some((p) => p.status === StudexaMonthPayState.OVERDUE)
    ? StudexaPayState.OVERDUE
    : StudexaPayState.PAID;
  await prisma.studexaStudent.update({
    where: { id: studentId },
    data: { paymentStatus: status },
  });
}

// ───────────────────────────────────────────── График

export type ChartPoint = [string, number];

/**
 * (шошго, 0–100 утга) хосуудаас SVG шугаман графикийн өгөгдөл. 1 утгатай
 * үед хавтгай шугам; хоосон бол null. Утга 0–100-д хумигдана.
 */
export function buildLineChart(
  values: ChartPoint[],
  width = 620,
  height = 140,
) {
  if (values.length === 0) return null;
  const vals = values.length === 1 ? [values[0], values[0]] : values;
  const n = vals.length;
  const points: string[] = [];
  const dots: { x: string; y: string; value: number }[] = [];
  vals.forEach(([, raw], i) => {
    const v = Math.max(0, Math.min(100, raw));
    const x = 8 + (i * (width - 16)) / (n - 1);
    const y = 12 + (height - 34) * (1 - v / 100);
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    dots.push({ x: x.toFixed(1), y: y.toFixed(1), value: v });
  });
  return {
    width,
    height,
    points: points.join(' '),
    dots,
    firstLabel: vals[0][0],
    lastLabel: vals[n - 1][0],
    lastValue: vals[n - 1][1],
  };
}

// ───────────────────────────────────────────── Дүн

export type ScoreTable = {
  dates: string[];
  rows: { label: string; cells: string[]; total: string; percent: string }[];
  earned: number;
  possible: number;
  percent: number;
  totalLabel: string;
};

/**
 * Сурагчийн дүнгийн хүснэгт — багш бүр ӨӨРИЙН багануудаа (нэр + дээд оноо)
 * тохируулна. Нийт дүн = авсан оноонуудын нийлбэр / оноо тавигдсан
 * багануудын дээд онооны нийлбэр (хувиар). Багана байхгүй бол null.
 */
export async function buildScoreTable(
  prisma: PrismaService,
  student: { id: string; teacherId: string },
): Promise<ScoreTable | null> {
  const columns = await prisma.studexaGradeColumn.findMany({
    where: { teacherId: student.teacherId },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
  });
  if (columns.length === 0) return null;
  const assessments = await prisma.studexaAssessment.findMany({
    where: { studentId: student.id },
  });
  const byColumn = new Map(assessments.map((a) => [a.columnId, a]));
  const dates = [...new Set(assessments.map((a) => a.date))].sort();

  let earned = 0;
  let possible = 0;
  const rows = columns.map((col) => {
    const a = byColumn.get(col.id);
    if (!a) {
      return {
        label: col.name,
        cells: dates.map(() => ''),
        total: `— / ${col.maxScore}`,
        percent: '—',
      };
    }
    earned += a.score;
    possible += col.maxScore;
    const pct = col.maxScore ? (a.score / col.maxScore) * 100 : 0;
    return {
      label: col.name,
      cells: dates.map((d) => (d === a.date ? String(a.score) : '')),
      total: `${a.score} / ${col.maxScore}`,
      percent: `${Math.round(pct)}%`,
    };
  });
  const percent = possible ? Math.round((100 * earned) / possible) : 0;
  return {
    dates,
    rows,
    earned,
    possible,
    percent,
    totalLabel: `${earned} / ${possible}`,
  };
}

const HW_POINTS: Record<string, number> = {
  DONE: 1,
  IN_PROGRESS: 0.5,
  PENDING: 0,
};

export type ClassTable = {
  colLabels: string[];
  columns: { id: string; name: string; maxScore: number }[];
  rows: {
    student: { id: string; name: string; group: string };
    att: string;
    hw: string;
    cells: (number | '')[];
    grand: number | null;
    grandLabel: string;
  }[];
};

/**
 * Ангийн нэгтгэл: мөр бүр нэг сурагч — Ирц, Даалгавар, багшийн баганууд,
 * Нийт оноо. Ирц нь recalcAttendance-ийн тооцсон нэг л утга.
 */
export async function buildClassTable(
  prisma: PrismaService,
  teacherId: string,
  students: {
    id: string;
    name: string;
    group: string;
    attendance: number;
    hwPercent: number | null;
  }[],
): Promise<ClassTable> {
  const columns = await prisma.studexaGradeColumn.findMany({
    where: { teacherId },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
  });
  const ids = students.map((s) => s.id);
  const [assessments, homeworks] = await Promise.all([
    ids.length
      ? prisma.studexaAssessment.findMany({ where: { studentId: { in: ids } } })
      : Promise.resolve([]),
    ids.length
      ? prisma.studexaHomework.findMany({
          where: { studentId: { in: ids } },
          select: { studentId: true, status: true },
        })
      : Promise.resolve([]),
  ]);
  const scoresBy = new Map<string, Map<string, number>>();
  for (const a of assessments) {
    if (!scoresBy.has(a.studentId)) scoresBy.set(a.studentId, new Map());
    scoresBy.get(a.studentId)!.set(a.columnId, a.score);
  }
  const hwBy = new Map<string, string[]>();
  for (const h of homeworks) {
    if (!hwBy.has(h.studentId)) hwBy.set(h.studentId, []);
    hwBy.get(h.studentId)!.push(h.status);
  }

  const rows = students.map((s) => {
    const scores = scoresBy.get(s.id) ?? new Map<string, number>();
    let hwDisp = '—';
    if (s.hwPercent !== null && s.hwPercent !== undefined) {
      hwDisp = `${s.hwPercent}%`;
    } else {
      const hws = hwBy.get(s.id) ?? [];
      if (hws.length) {
        const earned = hws.reduce((acc, st) => acc + (HW_POINTS[st] ?? 0), 0);
        hwDisp = `${Math.round((100 * earned) / hws.length)}%`;
      }
    }
    let earned = 0;
    let possible = 0;
    for (const col of columns) {
      const v = scores.get(col.id);
      if (v !== undefined) {
        earned += v;
        possible += col.maxScore;
      }
    }
    const percent = possible ? Math.round((100 * earned) / possible) : null;
    return {
      student: { id: s.id, name: s.name, group: s.group },
      att: `${s.attendance}%`,
      hw: hwDisp,
      cells: columns.map((c) => scores.get(c.id) ?? ('' as const)),
      grand: percent,
      grandLabel:
        percent === null ? '—' : `${earned} / ${possible} (${percent}%)`,
    };
  });

  return {
    colLabels: columns.map((c) => `${c.name} (${c.maxScore})`),
    columns: columns.map((c) => ({
      id: c.id,
      name: c.name,
      maxScore: c.maxScore,
    })),
    rows,
  };
}

// ───────────────────────────────────────────── Хуваарь

export type ScheduleLesson = {
  id: string;
  title: string;
  group: string;
  weekday: number;
  startTime: string;
  endTime: string;
  color: string;
};

export type ScheduleGrid = {
  hours: { label: string; top: number }[];
  days: {
    label: string;
    weekday: number;
    lessons: { lesson: ScheduleLesson; top: number; height: number }[];
  }[];
};

function minutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Багшийн хуваарийг 7 хоногийн цагийн торонд байрлуулна. group өгвөл тухайн
 * бүлгийн + бүх бүлгийн (group хоосон) хичээлүүдийг л оруулна.
 */
export async function buildScheduleGrid(
  prisma: PrismaService,
  teacherId: string,
  group: string | null,
): Promise<ScheduleGrid> {
  const lessons = await prisma.studexaLesson.findMany({
    where: {
      teacherId,
      ...(group !== null ? { OR: [{ group: '' }, { group }] } : {}),
    },
    orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
  });
  const total = (DAY_END - DAY_START) * 60;
  const hours: { label: string; top: number }[] = [];
  for (let h = DAY_START; h < DAY_END; h++) {
    hours.push({
      label: `${h}:00`,
      top: (100 * (h - DAY_START)) / (DAY_END - DAY_START),
    });
  }
  const days = WEEKDAYS.map((label, weekday) => ({
    label,
    weekday,
    lessons: lessons
      .filter((l) => l.weekday === weekday)
      .map((l) => {
        const start = minutes(l.startTime) - DAY_START * 60;
        const end = minutes(l.endTime) - DAY_START * 60;
        return {
          lesson: {
            id: l.id,
            title: l.title,
            group: l.group,
            weekday: l.weekday,
            startTime: l.startTime,
            endTime: l.endTime,
            color: l.color,
          },
          top: (100 * start) / total,
          height: (100 * (end - start)) / total,
        };
      }),
  }));
  return { hours, days };
}

const SCHEDULE_COLORS: Record<string, [string, string, string]> = {
  indigo: ['#eef2ff', '#c7d2fe', '#4f46e5'],
  green: ['#ccfbf1', '#99f6e4', '#0f766e'],
  purple: ['#f3e8ff', '#e9d5ff', '#7e22ce'],
};

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Хуваарийг SVG зураг болгоно (Studexa-гийн build_schedule_svg-тэй ижил) */
export function buildScheduleSvg(grid: ScheduleGrid, title: string): string {
  const W = 1200;
  const H = 760;
  const top = 80;
  const left = 64;
  const right = 20;
  const gridH = 650;
  const colW = (W - left - right) / grid.days.length;
  const nHours = DAY_END - DAY_START;
  const p: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="DejaVu Sans, Arial, sans-serif">`,
    `<rect width="${W}" height="${H}" fill="#ffffff"/>`,
    `<text x="20" y="36" font-size="20" font-weight="bold" fill="#111827">${esc(title)}</text>`,
    `<text x="${W - right}" y="36" font-size="11" text-anchor="end" fill="#6b7280">Studexa · ${todayStr().replace(/-/g, '.')}</text>`,
  ];
  grid.days.forEach((day, i) => {
    const x = left + i * colW + colW / 2;
    p.push(
      `<text x="${x.toFixed(1)}" y="${top - 12}" font-size="13" font-weight="600" text-anchor="middle" fill="#6b7280">${esc(day.label)}</text>`,
    );
  });
  for (let h = 0; h <= nHours; h++) {
    const y = top + (gridH * h) / nHours;
    p.push(
      `<line x1="${left}" y1="${y.toFixed(1)}" x2="${W - right}" y2="${y.toFixed(1)}" stroke="#e5e7eb" stroke-width="1"/>`,
    );
    if (h < nHours) {
      p.push(
        `<text x="${left - 6}" y="${(y + 4).toFixed(1)}" font-size="10" text-anchor="end" fill="#6b7280">${DAY_START + h}:00</text>`,
      );
    }
  }
  for (let i = 0; i <= grid.days.length; i++) {
    const x = left + i * colW;
    p.push(
      `<line x1="${x.toFixed(1)}" y1="${top}" x2="${x.toFixed(1)}" y2="${top + gridH}" stroke="#e5e7eb" stroke-width="1"/>`,
    );
  }
  grid.days.forEach((day, i) => {
    for (const item of day.lessons) {
      const [bg, border, txt] =
        SCHEDULE_COLORS[item.lesson.color] ?? SCHEDULE_COLORS.indigo;
      const x = left + i * colW + 3;
      const y = top + (gridH * item.top) / 100;
      const w = colW - 6;
      const h = (gridH * item.height) / 100;
      const label =
        item.lesson.title +
        (item.lesson.group ? ` · ${item.lesson.group}` : '');
      p.push(
        `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="6" fill="${bg}" stroke="${border}"/>`,
        `<text x="${(x + 6).toFixed(1)}" y="${(y + 15).toFixed(1)}" font-size="11" font-weight="bold" fill="${txt}">${esc(label.slice(0, 28))}</text>`,
      );
      if (h >= 30) {
        p.push(
          `<text x="${(x + 6).toFixed(1)}" y="${(y + 29).toFixed(1)}" font-size="10" fill="${txt}">${item.lesson.startTime}–${item.lesson.endTime}</text>`,
        );
      }
    }
  });
  p.push('</svg>');
  return p.join('');
}

// ───────────────────────────────────────────── CSV

/**
 * UTF-8 BOM CSV (Excel-д кирилл зөв) — платформын тайлангийн стандарт.
 * «=» -ээр эхэлсэн нүдийг (formula injection) апострофоор саармагжуулна.
 */
export function buildCsv(
  headers: string[],
  rows: (string | number)[][],
): string {
  const cell = (v: string | number) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers, ...rows].map((r) => r.map(cell).join(','));
  return '﻿' + lines.join('\r\n');
}

/** Content-Disposition-д зориулж файлын нэрийг URL-кодлоно */
export function contentDisposition(filename: string): string {
  return `attachment; filename="${filename}"; filename*=UTF-8''${escape(filename)}`;
}
