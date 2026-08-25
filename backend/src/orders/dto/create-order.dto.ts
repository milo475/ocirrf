import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class OrderItemInput {
  @IsUUID('4', { message: 'productId буруу форматтай' })
  productId: string;

  @IsInt({ message: 'Тоо ширхэг бүхэл тоо байна' })
  @Min(1, { message: 'Тоо ширхэг хамгийн багадаа 1 байна' })
  qty: number;
}

export class CreateOrderDto {
  @IsString()
  @MinLength(2, { message: 'Захиалагчийн нэр хамгийн багадаа 2 тэмдэгт' })
  customerName: string;

  @IsString()
  @IsNotEmpty({ message: 'Утасны дугаар хоосон байж болохгүй' })
  customerPhone: string;

  /** Хүргэлттэй систем тул хаяг заавал (v2) */
  @IsString()
  @IsNotEmpty({ message: 'Хүргэлтийн хаяг хоосон байж болохгүй' })
  address: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Дор хаяж 1 бараа сонгоно' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemInput)
  items: OrderItemInput[];
}
