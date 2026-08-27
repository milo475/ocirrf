import { Body, Controller, Get, Put } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { PERM } from '../permissions/permission-keys';
import { RequirePermission } from '../permissions/require-permission.decorator';
import { UpdateTariffsDto } from './dto/tariffs.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /** Нэвтэрсэн бүгдэд — зөвхөн public түлхүүрүүд */
  @Get()
  getPublic() {
    return this.settingsService.getPublic();
  }

  /** V4-06: login хуудасны "Нууц үг мартсан?" — нэвтрэлтгүйгээр компанийн утас */
  @Public()
  @Get('company')
  async company() {
    const s = await this.settingsService.getPublic();
    return { companyName: s.companyName, companyPhone: s.companyPhone };
  }

  /** Хүргэлтийн тариф (V4-05) — нэвтэрсэн бүгдэд (wizard уншина) */
  @Get('tariffs')
  tariffs() {
    return this.settingsService.tariffs();
  }

  @Put('tariffs')
  @RequirePermission(PERM.SETTINGS_EDIT)
  setTariffs(@Body() dto: UpdateTariffsDto) {
    return this.settingsService.setTariffs(dto.tariffs);
  }

  @Put()
  @RequirePermission(PERM.SETTINGS_EDIT)
  update(@Body() body: Record<string, string>) {
    return this.settingsService.setMany(body ?? {});
  }
}
