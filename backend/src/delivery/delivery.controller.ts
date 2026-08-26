import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../generated/prisma/client';
import { PERM } from '../permissions/permission-keys';
import { RequirePermission } from '../permissions/require-permission.decorator';
import { UPLOADS_DIR } from '../uploads.config';
import { DeliveryService } from './delivery.service';
import { AssignDriverDto } from './dto/assign-driver.dto';
import { CompleteDeliveryDto } from './dto/complete-delivery.dto';
import { RouteOrderDto } from './dto/route-order.dto';

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/** Зургийг таагдашгүй hash нэрээр UPLOADS_DIR-д хадгална */
const proofStorage = diskStorage({
  destination: UPLOADS_DIR,
  filename: (_req, file, cb) => {
    const ext = ALLOWED_MIME[file.mimetype] ?? '.jpg';
    cb(null, randomBytes(16).toString('hex') + ext);
  },
});

@Controller()
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  /** Жолооч хуваарилах — MANAGER-ийн гол үйлдэл */
  @Patch('orders/:id/assign-driver')
  @RequirePermission(PERM.ORDERS_ASSIGN_DRIVER)
  assignDriver(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignDriverDto,
  ) {
    return this.deliveryService.assignDriver(id, dto.driverId);
  }

  /** Жолооч нарын жагсаалт — MANAGER гүйцэтгэл/ачааллыг харна */
  @Get('drivers')
  @RequirePermission(PERM.DRIVERS_VIEW)
  driversList() {
    return this.deliveryService.driversList();
  }

  /** Хүргэлтийн ops самбар — статус бүрээр бүлэглэсэн + жолоочдын ачаалал */
  @Get('delivery-ops/board')
  @RequirePermission(PERM.ORDERS_VIEW, PERM.DRIVERS_VIEW)
  opsBoard() {
    return this.deliveryService.opsBoard();
  }

  /** Жолоочийн маршрутын дараалал тавих */
  @Patch('deliveries/route-order')
  @RequirePermission(PERM.DRIVERS_ASSIGN)
  setRouteOrder(@Body() dto: RouteOrderDto) {
    return this.deliveryService.setRouteOrder(dto.driverId, dto.orderIds);
  }

  /** Жолоочийн өөрийн дуусаагүй хүргэлтүүд */
  @Get('deliveries/my')
  @Roles(Role.DRIVER)
  myDeliveries(@CurrentUser() user: AuthUser) {
    return this.deliveryService.myDeliveries(user.id);
  }

  /** Жолоочийн гүйцэтгэл + цалин */
  @Get('deliveries/my/stats')
  @Roles(Role.DRIVER)
  myStats(@CurrentUser() user: AuthUser) {
    return this.deliveryService.myStats(user.id);
  }

  /**
   * Хүргэлт баталгаажуулах — multipart/form-data:
   * photo (jpg/png/webp, max 5MB) + success ('true'/'false') + note?
   */
  @Post('deliveries/:orderId/complete')
  @Roles(Role.DRIVER)
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: proofStorage,
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME[file.mimetype]) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException('Зөвхөн jpg/png/webp зураг зөвшөөрөгдөнө'),
            false,
          );
        }
      },
    }),
  )
  complete(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CompleteDeliveryDto,
    @CurrentUser() user: AuthUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.deliveryService.complete(orderId, user.id, dto, file);
  }
}
