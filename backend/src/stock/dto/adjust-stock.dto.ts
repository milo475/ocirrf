import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  NotEquals,
} from 'class-validator';

export class AdjustStockDto {
  @IsUUID('4', { message: 'productId буруу форматтай' })
  productId: string;

  /** Эерэг = орлого, сөрөг = зарлага */
  @IsInt({ message: 'qtyChange бүхэл тоо байна' })
  @NotEquals(0, { message: 'qtyChange 0 байж болохгүй' })
  qtyChange: number;

  @IsString()
  @IsNotEmpty({ message: 'Шалтгаан хоосон байж болохгүй' })
  reason: string;
}
