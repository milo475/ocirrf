import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { PERM } from '../permissions/permission-keys';
import { RequirePermission } from '../permissions/require-permission.decorator';
import { BatchesService } from './batches.service';
import { CreateBatchDto, WriteOffDto } from './dto/batch.dto';
import { ExpiryState } from '../stock/batch.util';

/**
 * Цуврал ба дуусах хугацаа.
 *
 * ЭРХ: шинэ түлхүүр нэмэхгүй — цуврал бол агуулахын ажил тул
 * `inventory.view` / `inventory.adjustment`-д тулгуурлана. Устгалд
 * гаргах нь мөн чанараараа үлдэгдлийн тохируулга.
 */
@Controller('batches')
export class BatchesController {
  constructor(private readonly batches: BatchesService) {}

  @Get()
  @RequirePermission(PERM.INVENTORY_VIEW)
  findAll(
    @Query('state') state?: ExpiryState | 'ALL',
    @Query('productId') productId?: string,
    @Query('includeEmpty') includeEmpty?: string,
  ) {
    return this.batches.findAll({
      state,
      productId,
      includeEmpty: includeEmpty === 'true',
    });
  }

  @Get('summary')
  @RequirePermission(PERM.INVENTORY_VIEW)
  summary() {
    return this.batches.summary();
  }

  @Post()
  @RequirePermission(PERM.INVENTORY_ADJUSTMENT)
  create(@Body() dto: CreateBatchDto, @CurrentUser() user: AuthUser) {
    return this.batches.create(dto, user);
  }

  @Post(':id/write-off')
  @RequirePermission(PERM.INVENTORY_ADJUSTMENT)
  writeOff(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WriteOffDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.batches.writeOff(id, dto, user);
  }
}
