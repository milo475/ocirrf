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

export class CreateApplicationDto {
  /** Тогтмол түлхүүр — жижиг үсэг/тоо/зураас. ҮҮССЭНИЙ ДАРАА СОЛИГДОХГҮЙ */
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/, {
    message: 'key нь жижиг латин үсэг, тоо, зураасаас бүрдэнэ (3-50 тэмдэгт)',
  })
  key: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nameMn: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nameEn: string;

  @IsString()
  @MinLength(2)
  @MaxLength(500)
  descriptionMn: string;

  /** lucide icon нэр (kebab-case) */
  @IsString()
  @MaxLength(50)
  icon: string;

  /** hex өнгө, жишээ #8b2635 */
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Өнгө hex хэлбэртэй байна (#rrggbb)' })
  color: string;

  @IsOptional()
  @IsEnum(AppStatus)
  status?: AppStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  sortOrder?: number;
}
