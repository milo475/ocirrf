import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { FinanceType } from '../../generated/prisma/client';

export class QueryFinanceEntriesDto {
  @IsOptional()
  @IsEnum(FinanceType, { message: 'Төрөл буруу (INCOME/EXPENSE)' })
  type?: FinanceType;

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

export class QueryFinanceSummaryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number = 30;
}
