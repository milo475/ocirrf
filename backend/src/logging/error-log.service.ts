import { Injectable, OnModuleInit } from '@nestjs/common';
import { appendFile, mkdir, readFile, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Алдааны төвлөрсөн лог (V4-14): logs/error-YYYY-MM-DD.log,
 * мөр бүр JSON. Production-д LOGS_DIR env-ээр өөр байршил зааж болно.
 */
export const LOGS_DIR = process.env.LOGS_DIR ?? join(process.cwd(), 'logs');

const KEEP_DAYS = 14;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type ErrorLogEntry = {
  timestamp: string;
  path: string;
  method: string;
  userId: string | null;
  message: string;
  stack: string | null;
};

function today(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

@Injectable()
export class ErrorLogService implements OnModuleInit {
  private cleanupTimer?: NodeJS.Timeout;

  async onModuleInit() {
    await mkdir(LOGS_DIR, { recursive: true });
    await this.cleanupOld();
    // 14 хоногоос хуучин файлыг өдөрт нэг шалгаж устгана
    this.cleanupTimer = setInterval(
      () => void this.cleanupOld().catch(() => undefined),
      24 * 60 * 60_000,
    );
    this.cleanupTimer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.cleanupTimer);
  }

  /** Нэг алдааг өнөөдрийн файлд JSON мөрөөр нэмнэ (fire-and-forget) */
  async append(entry: ErrorLogEntry) {
    try {
      await mkdir(LOGS_DIR, { recursive: true });
      await appendFile(
        join(LOGS_DIR, `error-${today()}.log`),
        JSON.stringify(entry) + '\n',
        'utf8',
      );
    } catch {
      // Лог бичилт өөрөө алдаа болж хүсэлтийг унагахгүй
    }
  }

  /** Тухайн өдрийн алдаанууд — сүүлийнх нь эхэндээ */
  async read(date?: string): Promise<ErrorLogEntry[]> {
    const d = date && DATE_RE.test(date) ? date : today();
    try {
      const text = await readFile(join(LOGS_DIR, `error-${d}.log`), 'utf8');
      return text
        .split('\n')
        .filter((l) => l.trim().length > 0)
        .map((l) => {
          try {
            return JSON.parse(l) as ErrorLogEntry;
          } catch {
            return null;
          }
        })
        .filter((e): e is ErrorLogEntry => e !== null)
        .reverse();
    } catch {
      return []; // файл байхгүй = тэр өдөр алдаа гараагүй
    }
  }

  /** error-YYYY-MM-DD.log нэртэй, 14 хоногоос хуучин файлуудыг устгана */
  async cleanupOld() {
    const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60_000;
    let files: string[];
    try {
      files = await readdir(LOGS_DIR);
    } catch {
      return;
    }
    for (const f of files) {
      const m = f.match(/^error-(\d{4}-\d{2}-\d{2})\.log$/);
      if (!m) continue;
      if (new Date(m[1]).getTime() < cutoff) {
        await unlink(join(LOGS_DIR, f)).catch(() => undefined);
      }
    }
  }
}
