import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AppStatus } from '../../generated/prisma/client';

/**
 * App засварын DTO — `key` талбар САНААТАЙГААР БАЙХГҮЙ: production-д
 * орсон key өөрчлөгдөхгүй (frontend манифест, идэвхжүүлэлт key-ээр
 * холбогддог). ValidationPipe whitelist тул илгээсэн ч хаягдана.
 */
export class UpdateApplicationDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nameMn?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nameEn?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  descriptionMn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, {
    message: 'Өнгө hex хэлбэртэй байна (#rrggbb)',
  })
  color?: string;

  @IsOptional()
  @IsEnum(AppStatus)
  status?: AppStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  sortOrder?: number;
}
