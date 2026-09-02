import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { PlatformAdminService } from './platform-admin.service';
import { SuperAdminGuard } from './super-admin.guard';

/**
 * ПЛАТФОРМЫН SUPERADMIN КОНСОЛ (Prompt 5) — бүх route isSuperAdmin
 * шаардана. Байгууллагын permission системд ОГТ хамааралгүй.
 */
@Controller('platform/admin')
@UseGuards(SuperAdminGuard)
export class PlatformAdminController {
  constructor(private readonly adminService: PlatformAdminService) {}

  @Get('organizations')
  organizations(@Query('search') search?: string) {
    return this.adminService.listOrganizations(search);
  }

  @Get('stats')
  stats() {
    return this.adminService.stats();
  }

  @Patch('organizations/:id/suspend')
  suspend(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.suspend(id);
  }

  @Patch('organizations/:id/activate')
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.activate(id);
  }

  @Get('apps')
  apps() {
    return this.adminService.listAllApps();
  }

  @Post('apps')
  createApp(@Body() dto: CreateApplicationDto) {
    return this.adminService.createApp(dto);
  }

  @Patch('apps/:id')
  updateApp(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApplicationDto,
  ) {
    return this.adminService.updateApp(id, dto);
  }
}
