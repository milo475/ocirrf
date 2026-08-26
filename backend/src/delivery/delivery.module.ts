import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';

@Module({
  imports: [FinanceModule], // DELIVERED болоход авто орлого бүртгэнэ
  controllers: [DeliveryController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
