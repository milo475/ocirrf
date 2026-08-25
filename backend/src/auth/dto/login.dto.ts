import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Имэйл хаяг буруу байна' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Нууц үг хоосон байж болохгүй' })
  password: string;
}
