import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  controllers: [FinanceController, PaymentsController],
  providers: [FinanceService, PaymentsService],
  exports: [FinanceService, PaymentsService],
})
export class FinanceModule {}
