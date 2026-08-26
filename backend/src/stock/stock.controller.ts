import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { PERM } from '../permissions/permission-keys';
import { RequirePermission } from '../permissions/require-permission.decorator';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import {
  QueryMovementsDto,
  QuerySummaryDto,
} from './dto/query-movements.dto';
import { StockService } from './stock.service';

@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  /** Орлого/зарлага — MANAGER-ийн гол хэрэгсэл */
  @Post('adjust')
  @RequirePermission(PERM.INVENTORY_ADJUSTMENT)
  adjust(@Body() dto: AdjustStockDto, @CurrentUser() user: AuthUser) {
    return this.stockService.adjust(dto, user.id);
  }

  @Get('movements')
  @RequirePermission(PERM.INVENTORY_VIEW)
  movements(@Query() query: QueryMovementsDto) {
    return this.stockService.movements(query);
  }

  /** Өдөр тутмын орлого/зарлагын нийлбэр — manager dashboard */
  @Get('summary')
  @RequirePermission(PERM.REPORTS_INVENTORY)
  summary(@Query() query: QuerySummaryDto) {
    return this.stockService.summary(query.days);
  }
}
