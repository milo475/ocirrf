import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { OrgContext } from '../../org/org-context';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../decorators/current-user.decorator';
import type { JwtPayload } from '../auth.service';

/**
 * JWT нууцуудыг серверийг ЭХЛЭХЭД шалгана.
 *
 * JWT_REFRESH_SECRET дутуу бол өмнө нь зөвхөн login дээр 500 гарч
 * байсан; хоёр нууц ИЖИЛ бол 7 хоногийн refresh token нь 15 минутын
 * access token-ий оронд шууд хүчинтэй болж, revoke хийсэн ч access
 * хэлбэрээр ажилласаар байх байв. Аль алиныг нь эхлэхэд таслана.
 */
export function assertJwtSecrets(): { secret: string; refresh: string } {
  const secret = process.env.JWT_SECRET;
  const refresh = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET тохируулагдаагүй байна (.env)');
  }
  if (!refresh) {
    throw new Error('JWT_REFRESH_SECRET тохируулагдаагүй байна (.env)');
  }
  if (secret === refresh) {
    throw new Error(
      'JWT_SECRET ба JWT_REFRESH_SECRET ижил байж болохгүй — refresh token ' +
        'access token-ий оронд хүчинтэй болно (openssl rand -hex 32 тус бүрд)',
    );
  }
  return { secret, refresh };
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    const { secret } = assertJwtSecrets();
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /** Token хүчинтэй бол DB-ээс хэрэглэгчийг дахин шалгана */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    // jti нь зөвхөн REFRESH token-д байдаг — refresh token-ыг Bearer
    // болгон хэрэглэхийг хориглоно (нууц ижил/алдагдсан үеийн хамгаалалт)
    if (payload.jti) {
      throw new UnauthorizedException('Нэвтрэх эрх хүчингүй');
    }

    // Байгууллага ХАРААХАН тодорхойгүй тул bypass-аар уншина —
    // энэ уншилт өөрөө л байгууллагыг тогтоодог (Multi-tenancy)
    const user = await OrgContext.runBypassed(() =>
      this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { organization: { select: { isActive: true } } },
      }),
    );

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Нэвтрэх эрх хүчингүй');
    }
    // Түдгэлзсэн байгууллагын хэрэглэгч access token-ий үлдсэн
    // хугацаанд (15 мин хүртэл) ажилласаар байдаг байв — одоо шууд хаана
    if (!user.organization.isActive) {
      throw new UnauthorizedException(
        'Танай байгууллагын эрх түдгэлзсэн байна',
      );
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
