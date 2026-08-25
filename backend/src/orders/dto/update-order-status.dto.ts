import { IsEnum } from 'class-validator';
import { OrderStatus } from '../../generated/prisma/client';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus, { message: 'Захиалгын статус буруу' })
  status: OrderStatus;
}
