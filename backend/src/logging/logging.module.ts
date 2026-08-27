import { Global, Module } from '@nestjs/common';
import { ErrorLogService } from './error-log.service';
import { ErrorsController } from './errors.controller';

/** Алдааны төвлөрсөн лог (V4-14) — filter нь AppModule-д APP_FILTER-ээр */
@Global()
@Module({
  controllers: [ErrorsController],
  providers: [ErrorLogService],
  exports: [ErrorLogService],
})
export class LoggingModule {}
