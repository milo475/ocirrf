import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { DeliveryRegion, OrderChannel } from '../../generated/prisma/client';
import { OrderItemInput } from './create-order.dto';

/**
 * Захиалга засах (V5).
 *
 * DM-ээр ирдэг ажилд хэрэглэгч хаягаа буруу хэлэх, «нэгийг нэмээд өгөөч»
 * гэх нь өдөр тутмын явдал. Өмнө нь баталгаажсаны дараа ямар ч засвар
 * хийх боломжгүй байсан тул захиалгыг ЦУЦЛААД дахин шивэхээс өөр арга
 * байхгүй байв (дугаар үсэрч, түүх тасардаг).
 *
 * `region` илгээвэл хаягийн бүх талбарыг ХАМТ илгээнэ — эсрэг горимын
 * талбарууд цэвэрлэгдэнэ. `items` илгээвэл БҮТЭН жагсаалт байна
 * (хэсэгчилсэн нэмэлт биш) — үлдэгдэл зөрүүгээр нь тохируулагдана.
 */
export class UpdateOrderDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Хүлээн авагчийн нэр хамгийн багадаа 2 тэмдэгт' })
  @MaxLength(120)
  customerName?: string;

  @IsOptional()
  @Matches(/^\d{8}$/, { message: 'Утасны дугаар 8 оронтой тоо байна' })
  customerPhone?: string;

  @IsOptional()
  @Matches(/^\d{8}$/, { message: 'Нэмэлт утас 8 оронтой тоо байна' })
  extraPhone?: string;

  @IsOptional()
  @IsEnum(DeliveryRegion, {
    message: 'Бүс буруу (ULAANBAATAR эсвэл ORON_NUTAG)',
  })
  region?: DeliveryRegion;

  @ValidateIf((o: UpdateOrderDto) => o.region === 'ULAANBAATAR')
  @IsString()
  @IsNotEmpty({ message: 'Дүүрэг заавал' })
  @MaxLength(60)
  district?: string;

  @ValidateIf((o: UpdateOrderDto) => o.region === 'ULAANBAATAR')
  @IsString()
  @IsNotEmpty({ message: 'Хороо заавал' })
  @MaxLength(60)
  khoroo?: string;

  @ValidateIf((o: UpdateOrderDto) => o.region === 'ULAANBAATAR')
  @IsString()
  @IsNotEmpty({ message: 'Байр/Хороолол заавал' })
  @MaxLength(120)
  building?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  entrance?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  floor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  door?: string;

  @ValidateIf((o: UpdateOrderDto) => o.region === 'ORON_NUTAG')
  @IsString()
  @IsNotEmpty({ message: 'Аймаг заавал' })
  @MaxLength(60)
  province?: string;

  @ValidateIf((o: UpdateOrderDto) => o.region === 'ORON_NUTAG')
  @IsString()
  @IsNotEmpty({ message: 'Сум/Суурин газар заавал' })
  @MaxLength(60)
  soum?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  transport?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressDetail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsEnum(OrderChannel, { message: 'Суваг буруу' })
  channel?: OrderChannel;

  /** Бүтэн жагсаалт — үлдэгдэл зөрүүгээр нь тохируулагдана */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Захиалгад дор хаяж 1 бараа байна' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemInput)
  items?: OrderItemInput[];
}
