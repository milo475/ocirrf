import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Захиалга болгох (V5).
 *
 * `paymentConfirmed` нь ажилтан данс дээрээ мөнгийг ХАРСАН гэдгийн
 * баталгаа. Үйлчлүүлэгчийн «Төлбөрөө хийсэн» товч нь зөвхөн мэдүүлэг
 * тул түүнд итгэж захиалга үүсгэхгүй.
 */
export class ConvertRequestDto {
  @IsBoolean({ message: 'Төлбөрийн баталгаажуулалт заавал' })
  paymentConfirmed: boolean;
}

export class RejectRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
