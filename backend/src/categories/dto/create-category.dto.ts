import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MinLength(2, { message: 'Нэр хамгийн багадаа 2 тэмдэгт байна' })
  @MaxLength(120)
  name: string;
}
