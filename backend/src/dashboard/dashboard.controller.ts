import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /** DASHBOARD.md Алхам 13: ProductHealth[] — mock-той яг ижил бүтэц */
  @Get('stock-health')
  stockHealth() {
    return this.dashboardService.stockHealth();
  }
}
