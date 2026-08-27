import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
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

  /** Өртөг (v4) — inventory.adjustment эрхтэйд л харагдана */
  @IsOptional()
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message: 'Өртөг буруу форматтай (жишээ: 8500 эсвэл 8500.50)',
  })
  costPrice?: string;

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

  /** Үүнээс доош орвол бага үлдэгдлийн анхааруулга (default 5) */
  @IsOptional()
  @IsInt({ message: 'lowStockLimit бүхэл тоо байна' })
  @Min(0)
  lowStockLimit?: number;

  // stockQty энд СНААТАЙГААР байхгүй: үлдэгдэл зөвхөн StockModule/OrderModule-ээр
  // StockMovement бичлэгтэй хамт өөрчлөгдөнө.
}
