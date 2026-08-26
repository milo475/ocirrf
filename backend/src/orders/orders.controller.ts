import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { PERM } from '../permissions/permission-keys';
import { RequirePermission } from '../permissions/require-permission.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /** Захиалга шивэх — зөвхөн ADMIN, OPERATOR (эрхийн матриц v2) */
  /**
   * Permission статик биш: CUSTOMER role-оороо зөвшөөрөгдөнө, бусад нь
   * orders.create — OrdersService дотор динамикаар шалгагдана.
   */
  @Post()
  create(@Body() dto: CreateOrderDto, @CurrentUser() user: AuthUser) {
    return this.ordersService.create(dto, user);
  }

  /** DRIVER бүх захиалга харахгүй — өөрийн хүргэлтээ delivery module-ээр авна */
  @Get()
  @RequirePermission(PERM.ORDERS_VIEW)
  findAll(@Query() query: QueryOrdersDto) {
    return this.ordersService.findAll(query);
  }

  @Get(':id')
  @RequirePermission(PERM.ORDERS_VIEW)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.findOne(id);
  }

  /** DRIVER статус өөрчлөхгүй — хүргэлтээ delivery module-ээр баталгаажуулна */
  @Patch(':id/status')
  @RequirePermission(PERM.ORDERS_CHANGE_STATUS)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ordersService.updateStatus(id, dto.status, user);
  }
}
