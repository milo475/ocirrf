import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Role, EmploymentType } from '../../generated/prisma/client';

export class CreateUserDto {
  @IsEmail({}, { message: 'Имэйл хаяг буруу байна' })
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(2, { message: 'Нэр хамгийн багадаа 2 тэмдэгт байна' })
  @MaxLength(120)
  name: string;

  @IsString()
  @MinLength(6, { message: 'Нууц үг хамгийн багадаа 6 тэмдэгт байна' })
  @MaxLength(128)
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
  @MaxLength(120)
  vehicleInfo?: string;

  /** Жолоочийн ажлын төрөл (V5): үндсэн / цагийн */
  @IsOptional()
  @IsEnum(EmploymentType, { message: 'Ажлын төрөл буруу' })
  employmentType?: EmploymentType;

  /** Аль харилцагч компанийн хүн бэ (V5) */
  @IsOptional()
  @IsUUID('4', { message: 'companyId буруу форматтай' })
  companyId?: string;

  /** Жолоочийн харьяалах бүс — дүүргийн товчлолууд (V5) */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(30)
  @MaxLength(10, { each: true })
  zones?: string[];
}
