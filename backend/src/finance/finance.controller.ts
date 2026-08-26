import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { CreateFinanceEntryDto } from './dto/create-finance-entry.dto';
import {
  QueryFinanceEntriesDto,
  QueryFinanceSummaryDto,
} from './dto/query-finance.dto';
import { FinanceService } from './finance.service';

/**
 * Permission нь type-аас хамаардаг тул @RequirePermission статикаар
 * зарлаагүй — FinanceService дотор динамикаар шалгагдана (403).
 */
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Post('entries')
  create(@Body() dto: CreateFinanceEntryDto, @CurrentUser() user: AuthUser) {
    return this.financeService.createEntry(dto, user);
  }

  @Get('entries')
  findAll(
    @Query() query: QueryFinanceEntriesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.financeService.findEntries(query, user);
  }

  @Get('summary')
  summary(
    @Query() query: QueryFinanceSummaryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.financeService.summary(query.days ?? 30, user);
  }
}
