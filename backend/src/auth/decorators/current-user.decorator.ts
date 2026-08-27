import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Role } from '../../generated/prisma/client';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  /** Түр нууц үгтэй — солитол бусад API 403 (V4-06) */
  mustChangePassword: boolean;
  /** Сүүлд нэвтэрсэн огноо (V4-07) */
  lastLoginAt: Date | null;
};

/** JwtStrategy.validate-ийн буцаасан хэрэглэгчийг controller-т öгнө */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return request.user;
  },
);
