import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CompleteDeliveryDto {
  /** multipart талбарууд string ирдэг тул 'true'/'false'-ыг хөрвүүлнэ */
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  success: boolean;

  /** Амжилтгүй үед заавал (шалтгаан) */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
