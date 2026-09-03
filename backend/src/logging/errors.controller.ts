import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PERM } from '../permissions/permission-keys';
import { RequirePermission } from '../permissions/require-permission.decorator';
import { SuperAdminGuard } from '../platform/super-admin.guard';
import { ErrorLogService } from './error-log.service';

/**
 * Системийн алдааны лог (V4-14).
 *
 * Лог нь ПЛАТФОРМЫН түвшний файл: бүх байгууллагын хүсэлтийн зам,
 * userId, алдааны мессеж нэг дор. Multi-tenancy-ийн дараа үүнийг
 * байгууллагын админд харуулах нь бусад байгууллагын мэдээлэл задлах
 * тул зөвхөн платформын SUPERADMIN уншина.
 */
@Controller('admin/errors')
@UseGuards(SuperAdminGuard)
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

    /**
     * PRODUCTION-Д STACK TRACE-ЫГ НУУНА (V5).
     *
     * Stack нь дотоод файлын зам, кодын бүтцийг ил гаргадаг —
     * халдагчид газрын зураг өгнө. Энэ хуудсыг зөвхөн ADMIN хардаг
     * ч эрхийг нь хожим өргөтгөвөл шууд задарна.
     *
     * Файлд бүтнээрээ бичигдсэн хэвээр — серверт нэвтэрсэн хүн
     * шаардлагатай үед бүтнээр нь харна.
     */
    if (process.env.NODE_ENV === 'production') {
      return {
        items: items.map(({ stack, ...rest }) => ({
          ...rest,
          stack: stack ? stack.split('\n')[0] : null,
        })),
        count: items.length,
      };
    }
    return { items, count: items.length };
  }

  /** Шалгалтын endpoint — зориуд 500 гаргаж лог ажиллаж буйг батлана */
  @Post('test')
  testError(): never {
    throw new Error('Тест алдаа — логжуулалтын шалгалт');
  }
}
