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

  /** Permission Panel — permissions.manage шаардана (default: зөвхөн ADMIN) */
  @Get(':id/permissions')
  @RequirePermission(PERM.PERMISSIONS_MANAGE)
  getPermissions(@Param('id', ParseUUIDPipe) id: string) {
    return this.permissionsService.getPanel(id);
  }

  @Put(':id/permissions')
  @RequirePermission(PERM.PERMISSIONS_MANAGE)
  updatePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserPermissionsDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.permissionsService.applyChanges(actor, id, dto.changes);
  }
}
