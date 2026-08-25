import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class QueryMovementsDto {
  @IsOptional()
  @IsUUID('4', { message: 'productId буруу форматтай' })
  productId?: string;

  /** PURCHASE_IN / MANUAL_OUT / CORRECTION / ORDER / ORDER_CANCEL г.м. */
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsDateString({}, { message: 'from огноо буруу форматтай (ISO)' })
  from?: string;

  @IsOptional()
  @IsDateString({}, { message: 'to огноо буруу форматтай (ISO)' })
  to?: string;

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

export class QuerySummaryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  days?: number = 7;
}
