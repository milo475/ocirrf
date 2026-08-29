import { Transform, Type } from 'class-transformer';
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
  customerName: string;

  @Matches(/^\d{8}$/, { message: 'Утасны дугаар 8 оронтой тоо байна' })
  phone: string;

  @IsOptional()
  @Matches(/^\d{8}$/, { message: 'Нэмэлт утас 8 оронтой тоо байна' })
  extraPhone?: string;

  /** Instagram/Facebook дээрх нэр — ажилтан ярианы холбоог олоход */
  @IsOptional()
  @IsString()
  socialName?: string;

  @IsOptional()
  @IsEnum(OrderChannel, { message: 'Суваг буруу' })
  channel?: OrderChannel;

  @IsEnum(DeliveryRegion, { message: 'Бүс буруу' })
  region: DeliveryRegion;

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
  @IsNotEmpty({ message: 'Байр/Хороолол заавал' })
  building?: string;

  @IsOptional()
  @IsString()
  entrance?: string;

  @IsOptional()
  @IsString()
  floor?: string;

  @IsOptional()
  @IsString()
  door?: string;

  @ValidateIf(ifON)
  @IsString()
  @IsNotEmpty({ message: 'Аймаг заавал' })
  province?: string;

  @ValidateIf(ifON)
  @IsString()
  @IsNotEmpty({ message: 'Сум/Суурин газар заавал' })
  soum?: string;

  /** Тээвэр — хэрэглэгч мэдэхгүй байж болно тул заавал биш */
  @IsOptional()
  @IsString()
  transport?: string;

  @IsOptional()
  @IsString()
  addressDetail?: string;

  @IsOptional()
  @IsString()
  note?: string;

  /**
   * Шилжүүлгээ хийсэн эсэх. multipart-аар "true"/"false" ТЕКСТ ирдэг тул
   * Boolean() ашиглаж болохгүй — "false" нь true болно.
   */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  paid?: boolean;

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
    ({ obj }) => {
      const raw =
        typeof obj.items === 'string' ? safeJson(obj.items) : obj.items;
      if (!Array.isArray(raw)) return raw;
      return raw.map((i: { productId?: string; qty?: unknown }) =>
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
  @ValidateNested({ each: true })
  items: RequestItemInput[];
}
