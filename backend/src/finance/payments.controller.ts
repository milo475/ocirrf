import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { PaymentMethod } from '../generated/prisma/client';
import { PERM } from '../permissions/permission-keys';
import {
  RequireAnyPermission,
  RequirePermission,
} from '../permissions/require-permission.decorator';
import { PaymentsService } from './payments.service';

class CreatePaymentDto {
  @IsString()
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message: 'Дүн буруу форматтай (жишээ: 12500 эсвэл 12500.50)',
  })
  amount: string;

  @IsEnum(PaymentMethod, { message: 'Хэлбэр буруу — зөвхөн TRANSFER (бэлэн мөнгө байхгүй)' })
  method: PaymentMethod;

  @IsOptional()
  @IsString()
  note?: string;
}

@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Захиалгын төлбөрийг санхүүгийн өргөн эрхтэй хүн ЭСВЭЛ зориулалтын
   * нарийн orders.record_payment эрхтэй хүн (борлуулагч) бүртгэнэ.
   * Устгах нь мөн адил — буруу бүртгэлээ засах, цуцлалтын өмнөх
   * мөнгө буцаалт хоёулаа энэ урсгалын хэсэг.
   */
  @Post('orders/:id/payments')
  @RequireAnyPermission(PERM.FINANCE_CREATE_INCOME, PERM.ORDERS_RECORD_PAYMENT)
  addPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.paymentsService.addPayment(id, dto, user);
  }

  @Delete('payments/:id')
  @RequireAnyPermission(PERM.FINANCE_CREATE_INCOME, PERM.ORDERS_RECORD_PAYMENT)
  deletePayment(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.deletePayment(id);
  }

  @Get('finance/receivables')
  @RequirePermission(PERM.FINANCE_VIEW_RECEIVABLES)
  receivables() {
    return this.paymentsService.receivables();
  }
}
