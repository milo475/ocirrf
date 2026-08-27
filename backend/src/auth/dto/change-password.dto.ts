import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Хуучин нууц үг заавал' })
  oldPassword: string;

  @IsString()
  @MinLength(6, { message: 'Шинэ нууц үг хамгийн багадаа 6 тэмдэгт байна' })
  newPassword: string;
}
