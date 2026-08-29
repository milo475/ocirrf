import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { ErrorLogService } from './error-log.service';

/**
 * Global exception filter (V4-14): 500-аас дээш (catch болоогүй) алдааг
 * файлд + console-д логлоно. Хариу буцаах ажлыг BaseExceptionFilter-т
 * үлдээснээр 400/403/validation зэрэг хэвийн алдааны хэлбэр өөрчлөгдөхгүй.
 */
@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  constructor(private readonly errorLog: ErrorLogService) {
    super();
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;

    // Зөвхөн серверийн алдаа (5xx) — энгийн 400/403 бичигдэхгүй
    if (status >= 500) {
      const req = host.switchToHttp().getRequest<{
        url?: string;
        method?: string;
        user?: AuthUser;
      }>();
      const err = exception instanceof Error ? exception : null;
      const entry = {
        timestamp: new Date().toISOString(),
        path: req?.url ?? '?',
        method: req?.method ?? '?',
        userId: req?.user?.id ?? null,
        message: err?.message ?? String(exception),
        stack: err?.stack ?? null,
      };
      void this.errorLog.append(entry);
      // Console дээр ч хэвээр харагдана
      console.error(
        `[${entry.timestamp}] ${entry.method} ${entry.path} — ${entry.message}`,
      );
    }

    super.catch(exception, host);
  }
}
