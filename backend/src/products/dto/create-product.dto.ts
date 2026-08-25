import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty({ message: 'SKU хоосон байж болохгүй' })
  sku: string;

  @IsString()
  @MinLength(2, { message: 'Нэр хамгийн багадаа 2 тэмдэгт байна' })
  name: string;

  /**
   * Мөнгөн дүнг string-ээр хүлээж авч Prisma Decimal руу шууд дамжуулна —
   * JS float-оор дамжвал дугуйруулалтын алдаа гарна.
   */
  @IsString()
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message: 'Үнэ буруу форматтай (жишээ: 12500 эсвэл 12500.50)',
  })
  price: string;

  @IsOptional()
  @IsUUID('4', { message: 'categoryId буруу форматтай' })
  categoryId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  unit?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // stockQty энд СНААТАЙГААР байхгүй: үлдэгдэл зөвхөн StockModule/OrderModule-ээр
  // StockMovement бичлэгтэй хамт өөрчлөгдөнө.
}
