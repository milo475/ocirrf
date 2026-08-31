import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { PERM } from '../permissions/permission-keys';
import { RequirePermission } from '../permissions/require-permission.decorator';
import { CreateSupplyDto } from './dto/create-supply.dto';
import { PaySupplyDto } from './dto/pay-supply.dto';
import { SuppliesService } from './supplies.service';

@Controller('supplies')
export class SuppliesController {
  constructor(private readonly supplies: SuppliesService) {}

  /** Харилцагч тус бүрийн тооцоо — ':id'-ээс ӨМНӨ байх ёстой */
  @Get('balances')
  @RequirePermission(PERM.SUPPLIES_VIEW)
  balances(@CurrentUser() user: AuthUser) {
    return this.supplies.balances(user);
  }

  @Get()
  @RequirePermission(PERM.SUPPLIES_VIEW)
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('unpaid') unpaid?: string,
  ) {
    return this.supplies.findAll(user, companyId, unpaid === 'true');
  }

  @Get(':id')
  @RequirePermission(PERM.SUPPLIES_VIEW)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.supplies.findOne(id, user);
  }

  /** Бараа хүлээж авах — үлдэгдэл ЭНД нэмэгдэнэ */
  @Post()
  @RequirePermission(PERM.SUPPLIES_CREATE)
  create(@Body() dto: CreateSupplyDto, @CurrentUser() user: AuthUser) {
    return this.supplies.createAndNotify(dto, user);
  }

  /** Харилцагчид төлбөр хийх — санхүүд ЗАРЛАГА болж бүртгэгдэнэ */
  @Post(':id/pay')
  @RequirePermission(PERM.SUPPLIES_PAY)
  pay(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PaySupplyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.supplies.pay(id, dto, user);
  }
}
