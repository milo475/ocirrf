import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { OrderStatus, Role } from '../generated/prisma/client';
import { PortalService } from './portal.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

class QueryPortalProductsDto {
  @IsOptional()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 8;
}

class QueryPortalOrdersDto {
  @IsOptional()
  @IsEnum(OrderStatus, { message: 'Статус буруу' })
  status?: OrderStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

/** Бүх route зөвхөн CUSTOMER — өөрийн өгөгдөл дээр л ажиллана */
@Controller('portal')
@Roles(Role.CUSTOMER)
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  @Get('products')
  products(@Query() query: QueryPortalProductsDto) {
    return this.portalService.searchProducts(query.search, query.limit);
  }

  @Get('orders')
  myOrders(
    @Query() query: QueryPortalOrdersDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.portalService.myOrders(
      user.id,
      query.status,
      query.page,
      query.limit,
    );
  }

  @Get('orders/:id')
  myOrder(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.portalService.myOrder(user.id, id);
  }

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.portalService.dashboard(user.id);
  }

  @Patch('profile')
  updateProfile(@Body() dto: UpdateProfileDto, @CurrentUser() user: AuthUser) {
    return this.portalService.updateProfile(user.id, dto);
  }

  @Patch('orders/:id/cancel')
  cancelOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.portalService.cancelOrder(user, id);
  }
}
