import { Module } from '@nestjs/common';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminService } from './platform-admin.service';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';

@Module({
  controllers: [PlatformController, PlatformAdminController],
  providers: [PlatformService, PlatformAdminService],
  exports: [PlatformService],
})
export class PlatformModule {}
