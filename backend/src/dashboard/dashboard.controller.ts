import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { DeliveryService } from '../delivery/delivery.service';
import { Role } from '../generated/prisma/client';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly deliveryService: DeliveryService,
  ) {}

  /** DASHBOARD.md Алхам 13: ProductHealth[] — v1 нүүр хуудас хэрэглэдэг */
  @Get('stock-health')
  stockHealth() {
    return this.dashboardService.stockHealth();
  }

  @Get('admin')
  @Roles(Role.ADMIN)
  admin() {
    return this.dashboardService.admin();
  }

  @Get('operator')
  @Roles(Role.OPERATOR)
  operator(@CurrentUser() user: AuthUser) {
    return this.dashboardService.operator(user.id);
  }

  @Get('manager')
  @Roles(Role.MANAGER, Role.ADMIN)
  manager() {
    return this.dashboardService.manager();
  }

  /** DeliveryService.myStats-ийг дахин ашиглана (нэг метод, хоёр route) */
  @Get('driver')
  @Roles(Role.DRIVER)
  driver(@CurrentUser() user: AuthUser) {
    return this.deliveryService.myStats(user.id);
  }
}
