import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class ReturnItemDto {
  @IsUUID()
  orderItemId: string;

  @IsInt()
  @Min(1)
  qty: number;
}

export class CreateReturnDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Буцаах бараа сонгоно уу' })
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items: ReturnItemDto[];

  @IsString()
  @IsNotEmpty({ message: 'Шалтгаан заавал' })
  reason: string;

  /** Үлдэгдэлд буцаан нэмэх эсэх */
  @IsOptional()
  @IsBoolean()
  restock?: boolean;

  /** Төлсөн дүнгээс буцаан олгох эсэх (EXPENSE "REFUND") */
  @IsOptional()
  @IsBoolean()
  refundPayment?: boolean;

  /** Жолоочийн цалингийн тооцооноос хасах эсэх */
  @IsOptional()
  @IsBoolean()
  excludeFromPayroll?: boolean;
}
