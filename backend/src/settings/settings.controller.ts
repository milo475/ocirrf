import { Body, Controller, Get, Put } from '@nestjs/common';
import { PERM } from '../permissions/permission-keys';
import { RequirePermission } from '../permissions/require-permission.decorator';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /** Нэвтэрсэн бүгдэд — зөвхөн public түлхүүрүүд */
  @Get()
  getPublic() {
    return this.settingsService.getPublic();
  }

  @Put()
  @RequirePermission(PERM.SETTINGS_EDIT)
  update(@Body() body: Record<string, string>) {
    return this.settingsService.setMany(body ?? {});
  }
}
