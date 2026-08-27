import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '../decorators/current-user.decorator';
import { ALLOW_TEMP_PASSWORD_KEY } from '../decorators/allow-temp-password.decorator';

/**
 * Түр нууц үгтэй хэрэглэгч нууц үгээ солитол бусад API-д 403 (V4-06).
 * Public route-д user байхгүй тул шууд нэвтэрнэ.
 */
@Injectable()
export class PasswordChangeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!req.user?.mustChangePassword) return true;

    const allowed = this.reflector.getAllAndOverride<boolean>(
      ALLOW_TEMP_PASSWORD_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowed) return true;

    throw new ForbiddenException(
      'Түр нууц үгээ солих шаардлагатай — Нууц үг солих хуудсаар орно уу',
    );
  }
}
