import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Хуучин нууц үг заавал' })
  @MaxLength(128)
  oldPassword: string;

  @IsString()
  @MinLength(6, { message: 'Шинэ нууц үг хамгийн багадаа 6 тэмдэгт байна' })
  @MaxLength(128)
  newPassword: string;
}
