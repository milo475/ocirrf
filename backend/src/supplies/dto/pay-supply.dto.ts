import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class PaySupplyDto {
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message: 'Дүн буруу форматтай (жишээ: 150000 эсвэл 150000.50)',
  })
  amount: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
