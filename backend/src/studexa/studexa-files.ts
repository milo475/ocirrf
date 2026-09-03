import { BadRequestException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { closeSync, openSync, readSync, unlinkSync } from 'node:fs';
import { extname } from 'node:path';
import { diskStorage } from 'multer';
import { UPLOADS_DIR } from '../uploads.config';

/**
 * STUDEXA-ГИЙН ФАЙЛ (даалгаврын хавсралт, сурагчийн илгээсэн ажил).
 *
 * Платформын uploads module зөвхөн ЗУРАГ (png/jpg/webp, 32 hex нэр)
 * үйлчилдэг; Studexa-д PDF мөн хэрэгтэй тул өөрийн нэрлэлт (`sx-` угтвар)
 * + өөрийн serve endpoint (/api/studexa/files/:name)-тэй. Угтвар нь
 * платформын UploadAccessGuard-ийн regex-д таардаггүй тул тэр замаар
 * задрахгүй; эрхийг StudexaHomeworkService.canAccessFile шийднэ.
 */
export const STUDEXA_FILE_RE = /^sx-[a-f0-9]{32}\.(pdf|png|jpe?g|gif|webp)$/;
export const STUDEXA_MAX_FILE_BYTES = 10 * 1024 * 1024;

const ALLOWED_EXT = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp']);

export const STUDEXA_CONTENT_TYPE: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

export const studexaStorage = diskStorage({
  destination: UPLOADS_DIR,
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname ?? '').toLowerCase();
    cb(
      null,
      `sx-${randomBytes(16).toString('hex')}${ALLOWED_EXT.has(ext) ? ext : '.bin'}`,
    );
  },
});

/** Multer fileFilter — өргөтгөлөөр урьдчилан шүүнэ (агуулгыг дараа шалгана) */
export function studexaFileFilter(
  _req: unknown,
  file: { originalname?: string },
  cb: (error: Error | null, accept: boolean) => void,
) {
  const ext = extname(file.originalname ?? '').toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    cb(
      new BadRequestException(
        'Зөвхөн PDF болон зураг (png, jpg, gif, webp) хавсаргаж болно',
      ),
      false,
    );
    return;
  }
  cb(null, true);
}

/**
 * Файлын ЖИНХЭНЭ агуулгыг эхний байтуудаар шалгана (magic bytes). Таарахгүй
 * бол устгаад татгалзана — HTML/скриптийг .png нэрээр оруулахаас сэргийлнэ.
 */
export function assertStudexaFile(path: string): void {
  let head: Buffer;
  try {
    const fd = openSync(path, 'r');
    try {
      head = Buffer.alloc(12);
      readSync(fd, head, 0, 12, 0);
    } finally {
      closeSync(fd);
    }
  } catch {
    throw new BadRequestException('Файлыг уншиж чадсангүй');
  }
  const ext = extname(path).toLowerCase();
  const ok =
    (ext === '.pdf' && head.toString('ascii', 0, 4) === '%PDF') ||
    (ext === '.png' &&
      head[0] === 0x89 &&
      head[1] === 0x50 &&
      head[2] === 0x4e &&
      head[3] === 0x47) ||
    ((ext === '.jpg' || ext === '.jpeg') &&
      head[0] === 0xff &&
      head[1] === 0xd8 &&
      head[2] === 0xff) ||
    (ext === '.gif' && head.toString('ascii', 0, 4) === 'GIF8') ||
    (ext === '.webp' &&
      head.toString('ascii', 0, 4) === 'RIFF' &&
      head.toString('ascii', 8, 12) === 'WEBP');
  if (ok) return;
  try {
    unlinkSync(path);
  } catch {
    /* устгаж чадаагүй ч татгалзсан хэвээр */
  }
  throw new BadRequestException(
    'Файлын агуулга өргөтгөлтэйгээ таарахгүй байна (PDF эсвэл зураг оруулна уу)',
  );
}

export function fileUrlFor(filename: string): string {
  return `/api/studexa/files/${filename}`;
}
