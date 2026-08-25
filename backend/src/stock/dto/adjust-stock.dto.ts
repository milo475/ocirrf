import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
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
}
