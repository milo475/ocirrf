import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RefreshDto {
  @IsString()
  @IsNotEmpty({ message: 'refreshToken шаардлагатай' })
  @MaxLength(1000)
  refreshToken: string;
}
