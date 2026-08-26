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
