import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
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

  @IsEnum(Role, { message: 'Role буруу (ADMIN эсвэл OPERATOR)' })
  role: Role;
}
