import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { DeliveryRegion } from '../../generated/prisma/client';

export class TariffDto {
  @IsEnum(DeliveryRegion)
  region: DeliveryRegion;

  @IsOptional()
  @IsString()
  district?: string | null;

  @Matches(/^\d{1,10}(\.\d{1,2})?$/, { message: 'Тариф буруу форматтай' })
  fee: string;
}

export class UpdateTariffsDto {
  @IsArray()
  @ArrayMinSize(2, { message: 'Бүс бүрийн default тариф заавал байна' })
  @ValidateNested({ each: true })
  @Type(() => TariffDto)
  tariffs: TariffDto[];
}
