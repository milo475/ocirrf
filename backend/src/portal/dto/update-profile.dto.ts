import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

/** Имэйл (username) солигдохгүй */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Нэр хоосон байж болохгүй' })
  name?: string;

  @IsOptional()
  @Matches(/^\d{8}$/, { message: 'Утасны дугаар 8 оронтой тоо байна' })
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Нууц үг хамгийн багадаа 6 тэмдэгт байна' })
  password?: string;

  /**
   * Нууц үг солих үед ЗААВАЛ — эс тэгвэл хулгайлагдсан access token-той
   * хэн ч бүртгэлийг бүрмөсөн эзэмшиж авна. `password` илгээгдсэн эсэхээс
   * хамаарах тул шалгалт нь service дотор (ValidateIf нь whitelist-тэй
   * хослоход төөрөгдөл үүсгэдэг).
   */
  @IsOptional()
  @IsString()
  currentPassword?: string;
}
