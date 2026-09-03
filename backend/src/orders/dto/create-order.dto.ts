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
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  DeliveryRegion,
  OrderChannel,
  PaymentMethod,
} from '../../generated/prisma/client';

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
  @MaxLength(120)
  customerName?: string;

  /**
   * Хүлээн авагчийн утас, 8 оронтой — заавал (service дотор шалгана).
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
  @MaxLength(60)
  district?: string;

  @ValidateIf(ifUB)
  @IsString()
  @IsNotEmpty({ message: 'Хороо заавал' })
  @MaxLength(60)
  khoroo?: string;

  @ValidateIf(ifUB)
  @IsString()
  @IsNotEmpty({ message: 'Барилга/Хороолол/Хашаа заавал' })
  @MaxLength(120)
  building?: string;

  @ValidateIf(ifUB)
  @IsString()
  @IsNotEmpty({ message: 'Орц заавал' })
  @MaxLength(20)
  entrance?: string;

  @ValidateIf(ifUB)
  @IsString()
  @IsNotEmpty({ message: 'Давхар заавал' })
  @MaxLength(20)
  floor?: string;

  @ValidateIf(ifUB)
  @IsString()
  @IsNotEmpty({ message: 'Хаалга заавал' })
  @MaxLength(20)
  door?: string;

  // ── Орон нутгийн горим: заавал ──
  @ValidateIf(ifON)
  @IsString()
  @IsNotEmpty({ message: 'Аймаг заавал' })
  @MaxLength(60)
  province?: string;

  @ValidateIf(ifON)
  @IsString()
  @IsNotEmpty({ message: 'Сум/Суурин газар заавал' })
  @MaxLength(60)
  soum?: string;

  @ValidateIf(ifON)
  @IsString()
  @IsNotEmpty({ message: 'Ачаа явах тээвэр заавал' })
  @MaxLength(120)
  transport?: string;

  /** Хаягийн дэлгэрэнгүй (орон нутгийн нэмэлт, чөлөөт текст) */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressDetail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  /** Захиалга ирсэн суваг (V5) — Instagram/Facebook/Утас; орхивол OTHER */
  @IsOptional()
  @IsEnum(OrderChannel, { message: 'Суваг буруу' })
  channel?: OrderChannel;

  /**
   * "Төлсөн" гэж үүсгэх — бүтэн төлбөр нь захиалгатай нэг transaction-д
   * бүртгэгдэнэ (Payment + INCOME entry).
   */
  @IsOptional()
  @IsBoolean()
  paid?: boolean;

  @IsArray()
  @ArrayMinSize(1, { message: 'Дор хаяж 1 бараа сонгоно' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemInput)
  items: OrderItemInput[];
}
