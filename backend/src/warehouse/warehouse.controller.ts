import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { PERM } from '../permissions/permission-keys';
import { RequirePermission } from '../permissions/require-permission.decorator';
import { WarehouseService } from './warehouse.service';

class AssignWarehouseDto {
  @IsUUID('4', { message: 'warehouseId буруу форматтай' })
  warehouseId: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Дор хаяж 1 захиалга сонгоно' })
  @IsUUID('4', { each: true })
  orderIds: string[];
}

class CreateHandoverDto {
  @IsUUID('4', { message: 'driverId буруу форматтай' })
  driverId: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Дор хаяж 1 захиалга сонгоно' })
  @IsUUID('4', { each: true })
  orderIds: string[];

  @IsOptional()
  @IsString()
  note?: string;
}

@Controller('warehouse')
export class WarehouseController {
  constructor(private readonly warehouse: WarehouseService) {}

  /** Идэвхтэй няравуудын жагсаалт — хуваарилах цонхонд */
  @Get('keepers')
  @RequirePermission(PERM.ORDERS_ASSIGN_WAREHOUSE)
  keepers() {
    return this.warehouse.keepers();
  }

  /** Менежер: захиалгуудыг няравт оноох */
  @Post('assign')
  @RequirePermission(PERM.ORDERS_ASSIGN_WAREHOUSE)
  assign(@Body() dto: AssignWarehouseDto) {
    return this.warehouse.assign(dto.orderIds, dto.warehouseId);
  }

  /** Няравын самбар — жолооч тус бүрээр нэгтгэсэн бараа */
  @Get('board')
  @RequirePermission(PERM.WAREHOUSE_HANDOVER)
  board(@CurrentUser() user: AuthUser, @Query('all') all?: string) {
    return this.warehouse.board(user, all !== 'true');
  }

  @Post('handovers')
  @RequirePermission(PERM.WAREHOUSE_HANDOVER)
  create(@Body() dto: CreateHandoverDto, @CurrentUser() user: AuthUser) {
    return this.warehouse.createHandover(dto, user);
  }

  @Get('handovers')
  @RequirePermission(PERM.WAREHOUSE_HANDOVER)
  list(@Query('driverId') driverId?: string) {
    return this.warehouse.listHandovers(driverId);
  }

  @Get('handovers/:id')
  @RequirePermission(PERM.WAREHOUSE_HANDOVER)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.warehouse.findHandover(id);
  }
}
