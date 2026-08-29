import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { PERM } from '../permissions/permission-keys';
import { RequirePermission } from '../permissions/require-permission.decorator';
import { ErrorLogService } from './error-log.service';

/** Системийн алдааны лог (V4-14) — activity_log.view эрхтэйд */
@Controller('admin/errors')
@RequirePermission(PERM.ACTIVITY_LOG_VIEW)
export class ErrorsController {
  constructor(private readonly errorLog: ErrorLogService) {}

  /** Тухайн өдрийн (default: өнөөдөр) алдаанууд */
  @Get()
  async list(@Query('date') date?: string) {
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('Огноо YYYY-MM-DD хэлбэртэй байна');
    }
    const items = await this.errorLog.read(date);
    return { items, count: items.length };
  }

  /** Шалгалтын endpoint — зориуд 500 гаргаж лог ажиллаж буйг батлана */
  @Post('test')
  testError(): never {
    throw new Error('Тест алдаа — логжуулалтын шалгалт');
  }
}
