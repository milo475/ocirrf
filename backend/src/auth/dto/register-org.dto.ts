import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Байгууллагын нээлттэй бүртгэл (Multi-tenancy): байгууллага + түүний
 * эхний ADMIN хэрэглэгч нэг transaction-д үүснэ.
 */
export class RegisterOrgDto {
  @IsString()
  @MinLength(2, { message: 'Байгууллагын нэр хамгийн багадаа 2 тэмдэгт' })
  @MaxLength(100)
  orgName: string;

  @IsString()
  @MinLength(2, { message: 'Нэр хамгийн багадаа 2 тэмдэгт' })
  @MaxLength(100)
  fullName: string;

  @IsEmail({}, { message: 'Имэйл хаяг буруу байна' })
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(6, { message: 'Нууц үг хамгийн багадаа 6 тэмдэгт байна' })
  @MaxLength(128)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}
