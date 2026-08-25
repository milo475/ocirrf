import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { DeliveryStatus, OrderStatus } from '../../generated/prisma/client';

export class QueryOrdersDto {
  @IsOptional()
  @IsEnum(OrderStatus, { message: 'Захиалгын статус буруу' })
  status?: OrderStatus;

  @IsOptional()
  @IsEnum(DeliveryStatus, { message: 'Хүргэлтийн статус буруу' })
  deliveryStatus?: DeliveryStatus;

  /** Тухайн жолоочид хуваарилагдсан захиалгууд */
  @IsOptional()
  @IsUUID('4', { message: 'driverId буруу форматтай' })
  driverId?: string;

  /** orderNo / customerName / phone дээр хайна */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
