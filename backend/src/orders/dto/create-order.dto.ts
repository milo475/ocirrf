import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { DeliveryRegion, PaymentMethod } from '../../generated/prisma/client';

export class OrderItemInput {
  @IsUUID('4', { message: 'productId буруу форматтай' })
  productId: string;

  @IsInt({ message: 'Тоо ширхэг бүхэл тоо байна' })
  @Min(1, { message: 'Тоо ширхэг хамгийн багадаа 1 байна' })
  qty: number;
}

/** УБ горимд заавал */
const ifUB = (o: CreateOrderDto) => o.region === 'ULAANBAATAR';
/** Орон нутгийн горимд заавал */
const ifON = (o: CreateOrderDto) => o.region === 'ORON_NUTAG';

export class CreateOrderDto {
  /** Хүлээн авагчийн нэр — заавал биш */
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Хүлээн авагчийн нэр хамгийн багадаа 2 тэмдэгт' })
  customerName?: string;

  /**
   * Хүлээн авагчийн утас, 8 оронтой. CUSTOMER орхивол профайлын утас
   * default болно; staff-д заавал (service дотор шалгана).
   */
  @IsOptional()
  @Matches(/^\d{8}$/, { message: 'Утасны дугаар 8 оронтой тоо байна' })
  customerPhone?: string;

  /** Нэмэлт (захиалагчийн) утас */
  @IsOptional()
  @Matches(/^\d{8}$/, { message: 'Нэмэлт утас 8 оронтой тоо байна' })
  extraPhone?: string;

  @IsEnum(DeliveryRegion, {
    message: 'Бүс буруу (ULAANBAATAR эсвэл ORON_NUTAG)',
  })
  region: DeliveryRegion;

  // ── УБ горим: бүгд заавал ──
  @ValidateIf(ifUB)
  @IsString()
  @IsNotEmpty({ message: 'Дүүрэг заавал' })
  district?: string;

  @ValidateIf(ifUB)
  @IsString()
  @IsNotEmpty({ message: 'Хороо заавал' })
  khoroo?: string;

  @ValidateIf(ifUB)
  @IsString()
  @IsNotEmpty({ message: 'Барилга/Хороолол/Хашаа заавал' })
  building?: string;

  @ValidateIf(ifUB)
  @IsString()
  @IsNotEmpty({ message: 'Орц заавал' })
  entrance?: string;

  @ValidateIf(ifUB)
  @IsString()
  @IsNotEmpty({ message: 'Давхар заавал' })
  floor?: string;

  @ValidateIf(ifUB)
  @IsString()
  @IsNotEmpty({ message: 'Хаалга заавал' })
  door?: string;

  // ── Орон нутгийн горим: заавал ──
  @ValidateIf(ifON)
  @IsString()
  @IsNotEmpty({ message: 'Аймаг заавал' })
  province?: string;

  @ValidateIf(ifON)
  @IsString()
  @IsNotEmpty({ message: 'Сум/Суурин газар заавал' })
  soum?: string;

  @ValidateIf(ifON)
  @IsString()
  @IsNotEmpty({ message: 'Ачаа явах тээвэр заавал' })
  transport?: string;

  /** Хаягийн дэлгэрэнгүй (орон нутгийн нэмэлт, чөлөөт текст) */
  @IsOptional()
  @IsString()
  addressDetail?: string;

  @IsOptional()
  @IsString()
  note?: string;

  /**
   * Хүргэлтийн хөлс (V4-05) — staff-ийн ГАР оруулга. Орхивол 0 болно:
   * шинэ захиалгад хөлс автоматаар НЭМЭГДЭХГҮЙ (9a97f4b-ийн шийдвэр),
   * DeliveryTariff хүснэгт нь Settings дэх ЛАВЛАГАА болж үлдсэн.
   * CUSTOMER-ийн илгээснийг service үл тоомсорлоно.
   */
  @IsOptional()
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message: 'Хүргэлтийн хөлс буруу форматтай',
  })
  deliveryFee?: string;

  /**
   * "Төлсөн" гэж үүсгэх — бүтэн төлбөр нь захиалгатай нэг transaction-д
   * бүртгэгдэнэ (Payment + INCOME). Зөвхөн staff; customer-ийнхийг
   * service үл тоомсорлоно.
   */
  @IsOptional()
  @IsBoolean()
  paid?: boolean;

  /** Төлсөн үеийн хэлбэр (default CASH) */
  @IsOptional()
  @IsEnum(PaymentMethod, { message: 'Төлбөрийн хэлбэр буруу' })
  paymentMethod?: PaymentMethod;

  @IsArray()
  @ArrayMinSize(1, { message: 'Дор хаяж 1 бараа сонгоно' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemInput)
  items: OrderItemInput[];
}
