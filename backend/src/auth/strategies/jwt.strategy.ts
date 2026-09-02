import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { OrgContext } from '../../org/org-context';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../decorators/current-user.decorator';
import type { JwtPayload } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET тохируулагдаагүй байна (.env)');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /** Token хүчинтэй бол DB-ээс хэрэглэгчийг дахин шалгана */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    // Байгууллага ХАРААХАН тодорхойгүй тул bypass-аар уншина —
    // энэ уншилт өөрөө л байгууллагыг тогтоодог (Multi-tenancy)
    const user = await OrgContext.runBypassed(() =>
      this.prisma.user.findUnique({
        where: { id: payload.sub },
      }),
    );

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Нэвтрэх эрх хүчингүй');
    }

    // Энэ request-ийн бүх дараагийн query энэ байгууллагад хязгаарлагдана
    OrgContext.set(user.organizationId);

    return {
      id: user.id,
      email: user.username,
      name: user.fullName,
      phone: user.phone,
      role: user.role,
      organizationId: user.organizationId,
      isSuperAdmin: user.isSuperAdmin,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: user.lastLoginAt,
      companyId: user.companyId,
    };
  }
}
