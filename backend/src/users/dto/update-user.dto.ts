import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '../../generated/prisma/client';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Нэр хамгийн багадаа 2 тэмдэгт байна' })
  name?: string;

  @IsOptional()
  @IsEnum(Role, { message: 'Role буруу (ADMIN эсвэл OPERATOR)' })
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Ирвэл дахин hash хийгдэнэ */
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Нууц үг хамгийн багадаа 6 тэмдэгт байна' })
  password?: string;
}
