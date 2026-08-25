import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../generated/prisma/client';
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
  @Roles(Role.ADMIN, Role.MANAGER)
  adjust(@Body() dto: AdjustStockDto, @CurrentUser() user: AuthUser) {
    return this.stockService.adjust(dto, user.id);
  }

  @Get('movements')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  movements(@Query() query: QueryMovementsDto) {
    return this.stockService.movements(query);
  }

  /** Өдөр тутмын орлого/зарлагын нийлбэр — manager dashboard */
  @Get('summary')
  @Roles(Role.ADMIN, Role.MANAGER)
  summary(@Query() query: QuerySummaryDto) {
    return this.stockService.summary(query.days);
  }
}
