import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  NotEquals,
} from 'class-validator';

/** Гар тохируулгын зөвшөөрөгдсөн шалтгаанууд (v2) */
export const ADJUST_REASONS = [
  'PURCHASE_IN', // орлого
  'MANUAL_OUT', // зарлага
  'CORRECTION', // тооллогын залруулга (+/- аль ч байж болно)
] as const;
export type AdjustReason = (typeof ADJUST_REASONS)[number];

export class AdjustStockDto {
  @IsUUID('4', { message: 'productId буруу форматтай' })
  productId: string;

  /** Эерэг = орлого, сөрөг = зарлага */
  @IsInt({ message: 'qtyChange бүхэл тоо байна' })
  @NotEquals(0, { message: 'qtyChange 0 байж болохгүй' })
  qtyChange: number;

  @IsIn(ADJUST_REASONS, {
    message: 'reason нь PURCHASE_IN, MANUAL_OUT, CORRECTION-ийн аль нэг байна',
  })
  reason: AdjustReason;

  @IsOptional()
  @IsString()
  note?: string;

  /** PURCHASE_IN үед нэгжийн өртөг — өгвөл барааны costPrice шинэчлэгдэнэ */
  @IsOptional()
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message: 'Өртөг буруу форматтай (жишээ: 8500 эсвэл 8500.50)',
  })
  unitCost?: string;
}
