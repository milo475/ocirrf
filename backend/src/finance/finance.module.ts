import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

@Module({
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService], // orders/delivery-ийн авто орлогод
})
export class FinanceModule {}
