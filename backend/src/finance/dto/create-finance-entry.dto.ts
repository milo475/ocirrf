import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { FinanceType } from '../../generated/prisma/client';

export class CreateFinanceEntryDto {
  @IsEnum(FinanceType, { message: 'Төрөл буруу (INCOME/EXPENSE)' })
  type: FinanceType;

  @IsString()
  @IsNotEmpty({ message: 'Ангилал заавал' })
  category: string;

  @IsString()
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message: 'Дүн буруу форматтай (жишээ: 12500 эсвэл 12500.50)',
  })
  amount: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsUUID('4', { message: 'refOrderId буруу форматтай' })
  refOrderId?: string;

  @IsOptional()
  @IsDateString({}, { message: 'entryDate огноо буруу форматтай (ISO)' })
  entryDate?: string;
}
