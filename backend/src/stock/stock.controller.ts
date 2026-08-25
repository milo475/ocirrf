import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../generated/prisma/client';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { QueryMovementsDto } from './dto/query-movements.dto';
import { StockService } from './stock.service';

@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Post('adjust')
  @Roles(Role.ADMIN)
  adjust(@Body() dto: AdjustStockDto, @CurrentUser() user: AuthUser) {
    return this.stockService.adjust(dto, user.id);
  }

  /** OPERATOR-т мөн нээлттэй (read-only түүх) */
  @Get('movements')
  movements(@Query() query: QueryMovementsDto) {
    return this.stockService.movements(query);
  }
}
