import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  ForbiddenException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { SecurityLogService } from './security-log.service';

/**
 * 403 бүрийг аюулгүй байдлын бүртгэлд бичнэ (V5).
 *
 * ═══ ЯАГААД ЯГ 403 ВЭ ═══
 * Энэ бол НЭВТЭРСЭН хүн эрхээсээ хэтрэх гэж оролдсон гэсэн үг —
 * дотоод эрсдэлийн хамгийн шууд дохио. Жишээ нь борлуулагч санхүү
 * рүү, нярав хэрэглэгчийн жагсаалт руу дахин дахин оролдож байвал
 * түүнийг харах ёстой.
 *
 * 401-ийг бүртгэхгүй: токен хугацаа дуусах бүрд гардаг бөгөөд
 * интернэтэд байрлах систем рүү автомат сканнер тасралтгүй ирдэг.
 * Тэднийг бичвэл хүснэгт хогоор дүүрч, жинхэнэ дохио дунд нь
 * алдагдана.
 *
 * Хариултыг ӨӨРЧЛӨХГҮЙ — зөвхөн тэмдэглээд ердийн 403-ыг буцаана.
 */
@Catch(ForbiddenException)
export class ForbiddenLogFilter implements ExceptionFilter {
  constructor(private readonly securityLog: SecurityLogService) {}

  catch(exception: ForbiddenException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { user?: AuthUser }>();
    const res = ctx.getResponse<Response>();

    void this.securityLog.forbidden(
      req.user?.id ?? null,
      req.method,
      req.originalUrl ?? req.url,
      req.ip ?? null,
    );

    const status = exception.getStatus();
    res.status(status).json(exception.getResponse());
  }
}
