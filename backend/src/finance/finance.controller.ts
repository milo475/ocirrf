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
import { manualCategories } from './finance-categories';
import { PnlRangeDto } from './dto/pnl-range.dto';
import { CreateFinanceEntryDto } from './dto/create-finance-entry.dto';
import { ClosePayrollDto, QueryPayrollDto } from './dto/payroll.dto';
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

  /**
   * Санхүүгийн байрлал — авлага, өглөг, бараа материал.
   * Permission нь service дотор шалгагдана (summary-тэй ижил).
   */
  @Get('position')
  position(@CurrentUser() user: AuthUser) {
    return this.financeService.position(user);
  }

  /** Орлого тайлан (P&L) — нягтланд өгөх үндсэн тайлан */
  @Get('pnl')
  pnl(@Query() q: PnlRangeDto, @CurrentUser() user: AuthUser) {
    const to = q.to ? new Date(q.to) : new Date();
    to.setHours(23, 59, 59, 999);
    const from = q.from ? new Date(q.from) : new Date(to);
    if (!q.from) from.setDate(from.getDate() - 29);
    from.setHours(0, 0, 0, 0);
    return this.financeService.pnl(from, to, user);
  }

  /** Гараар бүртгэхэд сонгож болох ангиллууд */
  @Get('categories')
  categories() {
    return {
      INCOME: manualCategories('INCOME'),
      EXPENSE: manualCategories('EXPENSE'),
    };
  }

  // ── Payroll — finance.driver_payroll permission ──

  @Get('payroll/pending')
  @RequirePermission(PERM.FINANCE_DRIVER_PAYROLL)
  payrollPending() {
    return this.financeService.payrollPending();
  }

  @Post('payroll/close')
  @RequirePermission(PERM.FINANCE_DRIVER_PAYROLL)
  payrollClose(@Body() dto: ClosePayrollDto, @CurrentUser() user: AuthUser) {
    return this.financeService.payrollClose(dto.driverId, user);
  }

  @Patch('payroll/:id/pay')
  @RequirePermission(PERM.FINANCE_DRIVER_PAYROLL)
  payrollPay(@Param('id', ParseUUIDPipe) id: string) {
    return this.financeService.payrollPay(id);
  }

  @Get('payroll')
  @RequirePermission(PERM.FINANCE_DRIVER_PAYROLL)
  payrollList(@Query() query: QueryPayrollDto) {
    return this.financeService.payrollList(query);
  }
}
