import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import {
  OrderRequestsController,
  PublicOrderController,
} from './order-requests.controller';
import { OrderRequestsService } from './order-requests.service';

@Module({
  imports: [OrdersModule],
  controllers: [PublicOrderController, OrderRequestsController],
  providers: [OrderRequestsService],
})
export class OrderRequestsModule {}
