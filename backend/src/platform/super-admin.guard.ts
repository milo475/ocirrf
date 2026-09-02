import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthUser } from '../auth/decorators/current-user.decorator';

/**
 * ПЛАТФОРМЫН SUPERADMIN GUARD — /api/platform/admin/* route-уудыг
 * хамгаална. Байгууллагын role/permission системээс БҮРЭН тусдаа:
 * User.isSuperAdmin флагаар л шалгана (JwtStrategy бөглөсөн).
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!req.user?.isSuperAdmin) {
      throw new ForbiddenException('Платформын админ эрх шаардлагатай');
    }
    return true;
  }
}
