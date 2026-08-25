import { Module } from '@nestjs/common';
import { DeliveryModule } from '../delivery/delivery.module';
import { StockModule } from '../stock/stock.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [StockModule, DeliveryModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
