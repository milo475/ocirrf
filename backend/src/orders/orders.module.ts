import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [FinanceModule], // COMPLETED болоход авто орлого бүртгэнэ
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
