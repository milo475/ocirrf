import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ActivityLogController } from './activity-log.controller';
import { ForbiddenLogFilter } from './forbidden.filter';
import { SecurityLogService } from './security-log.service';

@Module({
  controllers: [ActivityLogController],
  providers: [
    SecurityLogService,
    // 403 бүрийг аюулгүй байдлын бүртгэлд (V5)
    { provide: APP_FILTER, useClass: ForbiddenLogFilter },
  ],
  exports: [SecurityLogService],
})
export class ActivityLogModule {}
