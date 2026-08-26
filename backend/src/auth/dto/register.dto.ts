import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: 'Нэр заавал' })
  name: string;

  @IsEmail({}, { message: 'Имэйл буруу форматтай' })
  email: string;

  @Matches(/^\d{8}$/, { message: 'Утасны дугаар 8 оронтой тоо байна' })
  phone: string;

  @IsString()
  @MinLength(6, { message: 'Нууц үг хамгийн багадаа 6 тэмдэгт байна' })
  password: string;
}
