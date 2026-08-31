import { Module } from '@nestjs/common';
import { ReordersController } from './reorders.controller';
import { ReordersService } from './reorders.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  controllers: [ReordersController],
  providers: [ReordersService],
})
export class ReordersModule {}
