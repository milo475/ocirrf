import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'node:crypto';
import { Role } from '../generated/prisma/client';
import type { User } from '../generated/prisma/client';
import { PermissionsService } from '../permissions/permissions.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

export type JwtPayload = { sub: string; role: string; jti?: string };

const REFRESH_TTL_MS = 7 * 24 * 60 * 60_000; // 7 хоног — token-ий expiresIn-тэй ижил

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly permissionsService: PermissionsService,
  ) {}

  async login(dto: LoginDto) {
    // User.username талбарт email хэлбэрийн утга хадгалагддаг (seed-ийн дагуу)
    const user = await this.prisma.user.findUnique({
      where: { username: dto.email },
    });

    // Аль шалтгаанаар амжилтгүй болсныг ялгаж мэдэгдэхгүй
    const invalid = new UnauthorizedException('Нэвтрэх мэдээлэл буруу');

    if (!user || !user.isActive) {
      throw invalid;
    }

    // Түгжээ (V4-07): хугацаа дуустал ЗӨВ нууц үг ч нэвтрэхгүй
    const locked = new HttpException(
      'Бүртгэл түр түгжигдлээ (15 мин)',
      HttpStatus.LOCKED,
    );
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw locked;
    }

    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) {
      // 5 дахь буруу оролдлогод 15 минут түгжинэ, counter шинээр эхэлнэ
      const count = user.failedLoginCount + 1;
      const willLock = count >= 5;
      await this.prisma.user.update({
        where: { id: user.id },
        data: willLock
          ? {
              failedLoginCount: 0,
              lockedUntil: new Date(Date.now() + 15 * 60_000),
            }
          : { failedLoginCount: count },
      });
      throw willLock ? locked : invalid;
    }

    // Амжилттай: counter 0, түгжээ арилж, lastLoginAt шинэчлэгдэнэ
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    return this.issueTokens(updated);
  }


  /**
   * Refresh + ROTATION (V4-08): хуучин token revoke хийгдэж шинэ хос
   * олгогдоно. Revoke-логдсон token ДАХИН ирвэл — хулгайн шинж —
   * хэрэглэгчийн БҮХ token унтарна.
   */
  async refresh(dto: RefreshDto) {
    const invalid = new UnauthorizedException('Refresh token хүчингүй');
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(dto.refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw invalid;
    }
    if (!payload.jti) {
      throw invalid; // хуучин (rotation-гүй) token-ууд хүчингүй
    }

    const record = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
    });
    if (!record || record.tokenHash !== sha256(dto.refreshToken)) {
      throw invalid;
    }
    if (record.revokedAt) {
      // Хулгайн шинж: гэр бүлээр нь revoke
      await this.revokeAllTokens(record.userId);
      throw invalid;
    }
    if (record.expiresAt < new Date()) {
      throw invalid;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !user.isActive) {
      throw invalid;
    }

    // Хугацаа дууссан token-уудыг энд дайрч цэвэрлэнэ (өдөр тутмын cleanup)
    await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    const tokens = await this.issueTokens(user);
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date(), replacedById: tokens.refreshJti },
    });
    return tokens;
  }

  /** Logout (V4-08): тухайн refresh token-ыг revoke */
  async logout(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
      if (payload.jti) {
        await this.prisma.refreshToken.updateMany({
          where: { id: payload.jti, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    } catch {
      // Хүчингүй token-д ч logout амжилттай гэж үзнэ
    }
    return { ok: true };
  }

  /** Хэрэглэгчийн бүх refresh token-ыг унтраана (идэвхгүй болгох, нууц үг сэргээх) */
  async revokeAllTokens(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Нууц үг солих (V4-06) — түр нууц үгтэй хэрэглэгч энэ route-оор
   * ГАНЦХАН орж болно (@AllowTempPassword). Хуучин нууц үг заавал таарна.
   */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Нэвтрэх эрх хүчингүй');
    }
    const ok = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!ok) {
      throw new BadRequestException('Хуучин нууц үг буруу');
    }
    if (dto.oldPassword === dto.newPassword) {
      throw new BadRequestException('Шинэ нууц үг хуучинтай ижил байна');
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await bcrypt.hash(dto.newPassword, 10),
        mustChangePassword: false,
      },
    });
    // Хуучин session-ууд бүгд унтарч (V4-08) шинэ хос token олгогдоно
    await this.revokeAllTokens(userId);
    return this.issueTokens(updated);
  }

  private async issueTokens(user: User) {
    // jti (V4-08): refresh token DB-д hash-аар бүртгэгдэж rotation хийгдэнэ
    const jti = randomUUID();
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        { sub: user.id, role: user.role } satisfies JwtPayload,
        { secret: process.env.JWT_SECRET, expiresIn: '15m' },
      ),
      this.jwt.signAsync(
        { sub: user.id, role: user.role, jti } satisfies JwtPayload,
        { secret: process.env.JWT_REFRESH_SECRET, expiresIn: '7d' },
      ),
    ]);

    await this.prisma.refreshToken.create({
      data: {
        id: jti,
        userId: user.id,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    });

    // Frontend цэс/товчоо effective permission-оор нуудаг
    const permissions = await this.permissionsService.getEffectivePermissions(
      user.id,
      user.role,
    );

    return {
      accessToken,
      refreshToken,
      refreshJti: jti,
      user: {
        id: user.id,
        email: user.username,
        name: user.fullName,
        phone: user.phone,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        lastLoginAt: user.lastLoginAt,
        companyId: user.companyId,
        permissions: [...permissions],
      },
    };
  }
}
