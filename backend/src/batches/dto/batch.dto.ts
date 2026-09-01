import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

/** Хуучин үлдэгдэлд хугацаа зүүх — шинэ бараа НЭМЭХГҮЙ. */
export class CreateBatchDto {
  @IsUUID('4', { message: 'productId буруу форматтай' })
  productId: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Дуусах хугацаа YYYY-MM-DD хэлбэртэй байна',
  })
  expiryDate: string;

  @IsInt({ message: 'Тоо ширхэг бүхэл тоо байна' })
  @Min(1, { message: 'Тоо ширхэг хамгийн багадаа 1 байна' })
  qty: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  batchNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class WriteOffDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
