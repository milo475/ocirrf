import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class QueryMovementsDto {
  @IsOptional()
  @IsUUID('4', { message: 'productId буруу форматтай' })
  productId?: string;

  /** PURCHASE_IN / MANUAL_OUT / CORRECTION / ORDER / ORDER_CANCEL г.м. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;

  @IsOptional()
  @IsDateString({}, { message: 'from огноо буруу форматтай (ISO)' })
  @MaxLength(40)
  from?: string;

  @IsOptional()
  @IsDateString({}, { message: 'to огноо буруу форматтай (ISO)' })
  @MaxLength(40)
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
