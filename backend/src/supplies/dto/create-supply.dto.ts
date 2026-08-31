import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class SupplyItemInput {
  @IsUUID('4', { message: 'productId буруу форматтай' })
  productId: string;

  @IsInt({ message: 'Тоо ширхэг бүхэл тоо байна' })
  @Min(1, { message: 'Тоо ширхэг хамгийн багадаа 1 байна' })
  qty: number;

  /** Нэгжийн ӨРТӨГ — харилцагчид төлөх үнэ (string → Decimal) */
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message: 'Өртөг буруу форматтай (жишээ: 3500 эсвэл 3500.50)',
  })
  unitCost: string;

  /**
   * Дуусах хугацаа (YYYY-MM-DD) — СОНГОЛТТОЙ.
   * Өгвөл цуврал үүсч хугацааны хяналтад орно. Хугацаагүй бараанд
   * (сав, баглаа гэх мэт) хоосон орхино.
   */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Дуусах хугацаа YYYY-MM-DD хэлбэртэй байна',
  })
  expiryDate?: string;

  /** Үйлдвэрийн цувралын дугаар — заавал биш */
  @IsOptional()
  @IsString()
  batchNo?: string;
}

export class CreateSupplyDto {
  @IsUUID('4', { message: 'companyId буруу форматтай' })
  companyId: string;

  /** Барааг авчирсан харилцагч хүн — заавал биш */
  @IsOptional()
  @IsUUID('4', { message: 'supplierId буруу форматтай' })
  supplierId?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Дор хаяж 1 бараа оруулна' })
  @ValidateNested({ each: true })
  @Type(() => SupplyItemInput)
  items: SupplyItemInput[];
}
