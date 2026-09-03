import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { randomBytes } from 'node:crypto';
import { diskStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { OrderRequestStatus } from '../generated/prisma/client';
import { PERM } from '../permissions/permission-keys';
import { UPLOADS_DIR } from '../uploads.config';
import { RequirePermission } from '../permissions/require-permission.decorator';
import { PublicOrderRequestDto } from './dto/public-order-request.dto';
import { OrderRequestsService } from './order-requests.service';
import { assertRealImage } from '../uploads/image-content.util';
import { ConvertRequestDto, RejectRequestDto } from './dto/handle-request.dto';

const IMAGE_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const proofStorage = diskStorage({
  destination: UPLOADS_DIR,
  filename: (_req, file, cb) => {
    cb(
      null,
      randomBytes(16).toString('hex') + (IMAGE_MIME[file.mimetype] ?? '.jpg'),
    );
  },
});

/** Нийтийн маягт — нэвтрэлтгүй, зөвхөн зөв token-той хүн хандана */
@Controller('public')
export class PublicOrderController {
  constructor(private readonly service: OrderRequestsService) {}

  @Public()
  @Get('order-form')
  form(@Query('token') token?: string) {
    return this.service.publicForm(token);
  }

  @Public()
  @Post('order-requests')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('proof', {
      storage: proofStorage,
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => cb(null, file.mimetype in IMAGE_MIME),
    }),
  )
  submit(
    @Query('token') token: string,
    @Body() dto: PublicOrderRequestDto,
    @UploadedFile() proof?: Express.Multer.File,
  ) {
    if (proof) assertRealImage(proof.path);
    return this.service.submit(token, dto, proof?.filename);
  }
}

/** Ажилтны тал — хүсэлтүүдийг харах, захиалга болгох */
@Controller('order-requests')
export class OrderRequestsController {
  constructor(private readonly service: OrderRequestsService) {}

  @Get()
  @RequirePermission(PERM.ORDERS_VIEW)
  list(@Query('status') status?: OrderRequestStatus) {
    return this.service.list(status ?? OrderRequestStatus.NEW);
  }

  /** Нийтийн линк — ажилтан хуулж IG/FB-д илгээнэ */
  @Get('link')
  @RequirePermission(PERM.ORDERS_VIEW)
  async link() {
    return { token: await this.service.getOrCreateToken() };
  }

  @Post('link/rotate')
  @RequirePermission(PERM.SETTINGS_EDIT)
  async rotate() {
    return { token: await this.service.rotateToken() };
  }

  /**
   * Захиалга болгох. `paymentConfirmed` нь ажилтан ДАНС ДЭЭРЭЭ мөнгийг
   * харсан гэдгийн баталгаа — үйлчлүүлэгчийн мэдүүлэг биш (V5).
   */
  @Post(':id/convert')
  @RequirePermission(PERM.ORDERS_CREATE)
  convert(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConvertRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.convert(id, user, dto.paymentConfirmed === true);
  }

  @Post(':id/reject')
  @RequirePermission(PERM.ORDERS_CREATE)
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.reject(id, user, dto.reason);
  }
}
