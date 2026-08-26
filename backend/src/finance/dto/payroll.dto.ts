import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PayoutStatus } from '../../generated/prisma/client';

export class ClosePayrollDto {
  @IsUUID('4', { message: 'driverId буруу форматтай' })
  driverId: string;
}

export class QueryPayrollDto {
  @IsOptional()
  @IsUUID('4', { message: 'driverId буруу форматтай' })
  driverId?: string;

  @IsOptional()
  @IsEnum(PayoutStatus, { message: 'Статус буруу (PENDING/PAID)' })
  status?: PayoutStatus;
}
