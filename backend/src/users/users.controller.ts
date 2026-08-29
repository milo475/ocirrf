import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { PERM } from '../permissions/permission-keys';
import { PermissionsService } from '../permissions/permissions.service';
import { RequirePermission } from '../permissions/require-permission.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserPermissionsDto } from './dto/update-user-permissions.dto';
import { UsersService } from './users.service';

/** Бүх үйлдэл users.manage permission (default: зөвхөн ADMIN) */
@Controller('users')
@RequirePermission(PERM.USERS_MANAGE)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get()
  findAll(@Query() query: QueryUsersDto) {
    return this.usersService.findAll(query);
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.update(id, dto, user.id);
  }

  /** V4-07: нэвтрэлтийн түгжээ тайлах */
  @Patch(':id/unlock')
  unlock(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.unlock(id);
  }

  /** V4-06: түр нууц үг үүсгэнэ — хариунд НЭГ УДАА л ил ирнэ */
  @Post(':id/reset-password')
  resetPassword(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.resetPassword(id);
  }

  /**
   * Permission Panel — users.manage БА permissions.manage хоёуланг шаардана.
   * Reflector.getAllAndOverride нь handler-ийн метаданныг класс-ынхтай
   * НИЙЛҮҮЛДЭГГҮЙ, СОЛЬДОГ тул class-level users.manage энд автоматаар
   * үйлчлэхгүй — хоёуланг ил бичнэ. Эс тэгвэл зөвхөн permissions.manage-тэй
   * хүн users.manage-гүйгээр өөртөө дурын эрх олгож чадна.
   */
  @Get(':id/permissions')
  @RequirePermission(PERM.USERS_MANAGE, PERM.PERMISSIONS_MANAGE)
  getPermissions(@Param('id', ParseUUIDPipe) id: string) {
    return this.permissionsService.getPanel(id);
  }

  @Put(':id/permissions')
  @RequirePermission(PERM.USERS_MANAGE, PERM.PERMISSIONS_MANAGE)
  updatePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserPermissionsDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.permissionsService.applyChanges(actor, id, dto.changes);
  }
}
