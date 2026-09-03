import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { IsDateString, IsOptional } from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { PERM } from '../permissions/permission-keys';
import { RequirePermission } from '../permissions/require-permission.decorator';
import { ReportsService } from './reports.service';

class RangeDto {
  @IsOptional()
  @IsDateString({}, { message: 'from огноо буруу форматтай (ISO)' })
  from?: string;

  @IsOptional()
  @IsDateString({}, { message: 'to огноо буруу форматтай (ISO)' })
  to?: string;
}

function sendCsv(res: Response, name: string, csv: string) {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${name}-${stamp}.csv"`,
  });
  res.send(csv);
}

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('delivery.csv')
  @RequirePermission(PERM.REPORTS_DELIVERY)
  async delivery(@Query() q: RangeDto, @Res() res: Response) {
    sendCsv(
      res,
      'delivery',
      await this.reportsService.deliveryCsv(q.from, q.to),
    );
  }

  @Get('inventory.csv')
  @RequirePermission(PERM.REPORTS_INVENTORY)
  async inventory(@Query() q: RangeDto, @Res() res: Response) {
    sendCsv(
      res,
      'inventory',
      await this.reportsService.inventoryCsv(q.from, q.to),
    );
  }

  @Get('finance.csv')
  @RequirePermission(PERM.REPORTS_FINANCE)
  async finance(@Query() q: RangeDto, @Res() res: Response) {
    sendCsv(res, 'finance', await this.reportsService.financeCsv(q.from, q.to));
  }

  /** Орлого тайлан — нягтлан руу өгөх файл */
  @Get('pnl.csv')
  @RequirePermission(PERM.REPORTS_FINANCE)
  async pnl(
    @Query() q: RangeDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    sendCsv(
      res,
      'orlogo-tailan',
      await this.reportsService.pnlCsv(q.from, q.to, user),
    );
  }
}
