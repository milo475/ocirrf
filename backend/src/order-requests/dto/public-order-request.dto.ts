import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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
import { DeliveryRegion, OrderChannel } from '../../generated/prisma/client';

export class RequestItemInput {
  @IsUUID('4', { message: 'productId буруу форматтай' })
  productId: string;

  @IsInt({ message: 'Тоо ширхэг бүхэл тоо байна' })
  @Min(1, { message: 'Тоо ширхэг хамгийн багадаа 1 байна' })
  qty: number;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const ifUB = (o: PublicOrderRequestDto) =>
  o.region === DeliveryRegion.ULAANBAATAR;
const ifON = (o: PublicOrderRequestDto) =>
  o.region === DeliveryRegion.ORON_NUTAG;

/**
 * Нийтийн маягтаас ирэх өгөгдөл (V5). multipart/form-data-аар ирдэг тул
 * тоо/логик утгууд string байж болно — @Type-аар хөрвүүлнэ.
 */
export class PublicOrderRequestDto {
  @IsString()
  @MinLength(2, { message: 'Нэрээ бүтнээр нь бичнэ үү' })
  @MaxLength(120)
  customerName: string;

  @Matches(/^\d{8}$/, { message: 'Утасны дугаар 8 оронтой тоо байна' })
  phone: string;

  @IsOptional()
  @Matches(/^\d{8}$/, { message: 'Нэмэлт утас 8 оронтой тоо байна' })
  extraPhone?: string;

  /** Instagram/Facebook дээрх нэр — ажилтан ярианы холбоог олоход */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  socialName?: string;

  @IsOptional()
  @IsEnum(OrderChannel, { message: 'Суваг буруу' })
  channel?: OrderChannel;

  @IsEnum(DeliveryRegion, { message: 'Бүс буруу' })
  region: DeliveryRegion;

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

  /** Тээвэр — хэрэглэгч мэдэхгүй байж болно тул заавал биш */
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

  // `paid` талбар ХАСАГДСАН (V5): линкээр захиалахын тулд төлбөрөө
  // хийж, баримтаа хавсаргах ёстой тул «төлөөгүй» гэсэн сонголт
  // байхгүй. Баримт нь өөрөө төлсний нотолгоо.

  /**
   * multipart дээр массив шууд явдаггүй тул JSON ТЕКСТЭЭР ирнэ.
   *
   * АНХААР: @Type-тэй хамт @Transform хэрэглэвэл class-transformer
   * эхлээд текстийг RequestItemInput болгож хөрвүүлээд бүх талбар нь
   * undefined болдог. Тиймээс @Type-гүйгээр, эх (plain) утгаас нь
   * задалж, instance-ыг өөрсдөө үүсгэнэ — ингэж ValidateNested зөв
   * ажиллана.
   */
  @Transform(
    ({ obj }: { obj: { items?: unknown } }) => {
      const raw =
        typeof obj.items === 'string' ? safeJson(obj.items) : obj.items;
      if (!Array.isArray(raw)) return raw;
      return (raw as Array<{ productId?: unknown; qty?: unknown } | null>).map(
        (i) =>
          Object.assign(new RequestItemInput(), {
            productId: i?.productId,
            qty: Number(i?.qty),
          }),
      );
    },
    { toClassOnly: true },
  )
  @IsArray()
  @ArrayMinSize(1, { message: 'Дор хаяж 1 бараа сонгоно' })
  @ArrayMaxSize(200, { message: 'Нэг хүсэлтэд дээд тал нь 200 мөр' })
  @ValidateNested({ each: true })
  items: RequestItemInput[];
}
