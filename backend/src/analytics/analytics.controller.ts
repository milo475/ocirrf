import { Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PERM } from '../permissions/permission-keys';
import { RequirePermission } from '../permissions/require-permission.decorator';
import { AnalyticsService } from './analytics.service';

class RangeDto {
  @IsOptional()
  @IsDateString({}, { message: 'from огноо буруу форматтай (ISO)' })
  from?: string;

  @IsOptional()
  @IsDateString({}, { message: 'to огноо буруу форматтай (ISO)' })
  to?: string;
}

class SalesDto extends RangeDto {
  @IsOptional()
  @IsIn(['day', 'week'], { message: 'groupBy нь day эсвэл week' })
  groupBy?: 'day' | 'week';
}

class TopProductsDto extends RangeDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}

@Controller('analytics')
@RequirePermission(PERM.ANALYTICS_VIEW)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('sales')
  sales(@Query() q: SalesDto) {
    return this.analyticsService.sales(q.from, q.to, q.groupBy ?? 'day');
  }

  @Get('top-products')
  topProducts(@Query() q: TopProductsDto) {
    return this.analyticsService.topProducts(q.from, q.to, q.limit);
  }

  @Get('drivers')
  drivers(@Query() q: RangeDto) {
    return this.analyticsService.drivers(q.from, q.to);
  }

  @Get('customers')
  customers() {
    return this.analyticsService.customers();
  }
}
