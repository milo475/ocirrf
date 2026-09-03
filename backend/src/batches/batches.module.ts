import { Module } from '@nestjs/common';
import { BatchesController } from './batches.controller';
import { BatchesService } from './batches.service';
import { SettingsModule } from '../settings/settings.module';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  imports: [SettingsModule, PermissionsModule],
  controllers: [BatchesController],
  providers: [BatchesService],
  exports: [BatchesService],
})
export class BatchesModule {}
