import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Role } from '../generated/prisma/client';
import type { User } from '../generated/prisma/client';
import { PermissionsService } from '../permissions/permissions.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';

export type JwtPayload = { sub: string; role: string };

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

  /** Харилцагчийн өөрийн бүртгэл — үргэлж CUSTOMER эрхтэй */
  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({
      where: { username: dto.email },
    });
    if (exists) {
      throw new ConflictException('Энэ имэйл аль хэдийн бүртгэлтэй байна');
    }
    const user = await this.prisma.user.create({
      data: {
        username: dto.email,
        fullName: dto.name.trim(),
        phone: dto.phone,
        passwordHash: await bcrypt.hash(dto.password, 10),
        role: Role.CUSTOMER,
      },
    });
    return this.issueTokens(user);
  }

  async refresh(dto: RefreshDto) {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(dto.refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Refresh token хүчингүй');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Refresh token хүчингүй');
    }

    return this.issueTokens(user);
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
    // Шинэ token — хуучин session-ийн mustChangePassword төлөв цэвэрлэгдэнэ
    return this.issueTokens(updated);
  }

  private async issueTokens(user: User) {
    const payload: JwtPayload = { sub: user.id, role: user.role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: process.env.JWT_SECRET,
        expiresIn: '15m',
      }),
      this.jwt.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d',
      }),
    ]);

    // Frontend цэс/товчоо effective permission-оор нуудаг
    const permissions = await this.permissionsService.getEffectivePermissions(
      user.id,
      user.role,
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.username,
        name: user.fullName,
        phone: user.phone,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        lastLoginAt: user.lastLoginAt,
        permissions: [...permissions],
      },
    };
  }
}
