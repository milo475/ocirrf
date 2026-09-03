import { Body, Controller, Get, Put } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
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

  /**
   * V4-06: login хуудасны "Нууц үг мартсан?" — нэвтрэлтгүй endpoint.
   * Multi-tenancy-ийн дараа нэвтрээгүй хүний БАЙГУУЛЛАГА тодорхойгүй
   * тул аль нэг байгууллагын утас/нэрийг задлахгүй — статик утга.
   * (Public захиалгын хуудас нэр/утсаа order-form payload-оос авдаг.)
   */
  @Public()
  @Get('company')
  company() {
    return { companyName: 'ocirrf', companyPhone: '' };
  }

  @Put()
  @RequirePermission(PERM.SETTINGS_EDIT)
  update(@Body() body: Record<string, string>) {
    return this.settingsService.setMany(body ?? {});
  }
}
