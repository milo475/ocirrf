import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Имэйл хаяг буруу байна' })
  @MaxLength(254)
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Нууц үг хоосон байж болохгүй' })
  @MaxLength(128)
  password: string;
}
