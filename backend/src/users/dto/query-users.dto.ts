import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { Role } from '../../generated/prisma/client';

export class QueryUsersDto {
  @IsOptional()
  @IsEnum(Role, { message: 'Role буруу' })
  role?: Role;

  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : (value as unknown),
  )
  @IsBoolean()
  isActive?: boolean;
}
