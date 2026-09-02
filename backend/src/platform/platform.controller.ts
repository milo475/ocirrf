import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { PERM } from '../permissions/permission-keys';
import { RequirePermission } from '../permissions/require-permission.decorator';
import { PlatformService } from './platform.service';

@Controller('platform')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  /** Нэвтрэлтгүй нүүр хуудасны app card-ууд */
  @Public()
  @Get('apps')
  apps() {
    return this.platformService.listPublicApps();
  }

  /** Нэвтэрсэн хэрэглэгчийн байгууллагын идэвхтэй app-ууд (launcher) */
  @Get('my-apps')
  myApps() {
    return this.platformService.myApps();
  }

  /** Байгууллагадаа app идэвхжүүлэх (ADMIN default) */
  @Post('my-apps/:key/enable')
  @RequirePermission(PERM.PLATFORM_MANAGE_APPS)
  enable(@Param('key') key: string, @CurrentUser() user: AuthUser) {
    return this.platformService.enableApp(key, user.id);
  }

  /** Байгууллагаасаа app идэвхгүй болгох (цөм ursgal хамгаалагдсан) */
  @Delete('my-apps/:key')
  @RequirePermission(PERM.PLATFORM_MANAGE_APPS)
  disable(@Param('key') key: string) {
    return this.platformService.disableApp(key);
  }
}
