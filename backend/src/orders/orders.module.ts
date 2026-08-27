import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { ReturnsService } from './returns.service';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, ReturnsService],
  exports: [OrdersService],
})
export class OrdersModule {}
