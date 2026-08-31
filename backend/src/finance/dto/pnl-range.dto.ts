import { IsOptional, Matches } from 'class-validator';

/** Орлого тайлангийн хугацаа — YYYY-MM-DD (өгөөгүй бол сүүлийн 30 хоног) */
export class PnlRangeDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from огноо YYYY-MM-DD байна' })
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to огноо YYYY-MM-DD байна' })
  to?: string;
}
