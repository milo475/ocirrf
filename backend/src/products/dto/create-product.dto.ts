import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty({ message: 'SKU хоосон байж болохгүй' })
  @MaxLength(60)
  sku: string;

  @IsString()
  @MinLength(2, { message: 'Нэр хамгийн багадаа 2 тэмдэгт байна' })
  @MaxLength(120)
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

  /** Аль харилцагч компанийн бараа вэ (V5) */
  @IsOptional()
  @IsUUID('4', { message: 'companyId буруу форматтай' })
  companyId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Үүнээс доош орвол бага үлдэгдлийн анхааруулга (default 5) */
  @IsOptional()
  @IsInt({ message: 'lowStockLimit бүхэл тоо байна' })
  @Min(0)
  lowStockLimit?: number;

  /**
   * Нэг ширхэг нь хэрэглэгчид хэдэн хоног хүрэх вэ (V5).
   * Хоосон → тохиргооны ерөнхий утга; 0 → давтан захиалгад орохгүй.
   */
  @IsOptional()
  @IsInt({ message: 'daysSupply бүхэл тоо байна' })
  @Min(0)
  daysSupply?: number;

  // stockQty энд СНААТАЙГААР байхгүй: үлдэгдэл зөвхөн StockModule/OrderModule-ээр
  // StockMovement бичлэгтэй хамт өөрчлөгдөнө.
}
