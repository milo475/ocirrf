import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Role } from '../../generated/prisma/client';

export class CreateUserDto {
  @IsEmail({}, { message: 'Имэйл хаяг буруу байна' })
  email: string;

  @IsString()
  @MinLength(2, { message: 'Нэр хамгийн багадаа 2 тэмдэгт байна' })
  name: string;

  @IsString()
  @MinLength(6, { message: 'Нууц үг хамгийн багадаа 6 тэмдэгт байна' })
  password: string;

  @IsEnum(Role, { message: 'Role буруу' })
  role: Role;

  /** role=DRIVER үед заавал: хүргэлт тутмын хөлс (string → Decimal) */
  @ValidateIf((o: CreateUserDto) => o.role === 'DRIVER')
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message: 'feePerDelivery буруу форматтай (жишээ: 3000 эсвэл 3000.50)',
  })
  feePerDelivery?: string;

  @IsOptional()
  @IsString()
  vehicleInfo?: string;
}
