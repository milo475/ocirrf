import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { FinanceType } from '../../generated/prisma/client';

export class CreateFinanceEntryDto {
  @IsEnum(FinanceType, { message: 'Төрөл буруу (INCOME/EXPENSE)' })
  type: FinanceType;

  @IsString()
  @IsNotEmpty({ message: 'Ангилал заавал' })
  @MaxLength(60)
  category: string;

  @IsString()
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message: 'Дүн буруу форматтай (жишээ: 12500 эсвэл 12500.50)',
  })
  amount: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsUUID('4', { message: 'refOrderId буруу форматтай' })
  refOrderId?: string;

  @IsOptional()
  @IsDateString({}, { message: 'entryDate огноо буруу форматтай (ISO)' })
  @MaxLength(40)
  entryDate?: string;
}
