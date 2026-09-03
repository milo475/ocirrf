import {
  BadRequestException,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { UPLOADS_DIR } from '../uploads.config';
import { StudexaHomeworkService } from './homework.service';
import { STUDEXA_CONTENT_TYPE, STUDEXA_FILE_RE } from './studexa-files';

/**
 * Даалгаврын хавсралт / илгээсэн ажлыг үйлчилнэ — нэвтэрсэн + эзэмшлийн
 * шалгалттай (багш эсвэл тухайн сурагч). Нэрийн хэлбэр `sx-<32hex>.<ext>`
 * тул `../` зэрэг зам гаргах оролдлого regex дээр таслагдана.
 */
@Controller('studexa/files')
export class StudexaFilesController {
  constructor(private readonly homework: StudexaHomeworkService) {}

  @Get(':name')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cache-Control', 'private, max-age=3600')
  async serve(
    @CurrentUser() user: AuthUser,
    @Param('name') name: string,
    @Res() res: Response,
  ) {
    if (!STUDEXA_FILE_RE.test(name))
      throw new BadRequestException('Файлын нэр буруу');
    await this.homework.canAccessFile(user, name);
    const path = join(UPLOADS_DIR, name);
    if (!existsSync(path) || !statSync(path).isFile())
      throw new NotFoundException('Файл олдсонгүй');
    const ext = extname(name).toLowerCase();
    res.setHeader(
      'Content-Type',
      STUDEXA_CONTENT_TYPE[ext] ?? 'application/octet-stream',
    );
    // PDF-ийг browser дотор нээхгүй — татаж авна (PDF доторх скриптийн эрсдэлгүй)
    if (ext === '.pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    createReadStream(path).pipe(res);
  }
}
