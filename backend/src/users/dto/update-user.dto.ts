import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { Role } from '../../generated/prisma/client';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Нэр хамгийн багадаа 2 тэмдэгт байна' })
  name?: string;

  @IsOptional()
  @IsEnum(Role, { message: 'Role буруу' })
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Ирвэл дахин hash хийгдэнэ */
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Нууц үг хамгийн багадаа 6 тэмдэгт байна' })
  password?: string;

  /** Жолоочийн хүргэлт тутмын хөлс */
  @IsOptional()
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message: 'feePerDelivery буруу форматтай',
  })
  feePerDelivery?: string;

  @IsOptional()
  @IsString()
  vehicleInfo?: string;
}
