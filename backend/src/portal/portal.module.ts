import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';

@Module({
  imports: [OrdersModule], // цуцлалт staff-ийн transaction-тай ижил зам
  controllers: [PortalController],
  providers: [PortalService],
})
export class PortalModule {}
