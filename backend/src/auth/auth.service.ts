import {
  BadRequestException,
  ConflictException,
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

    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) {
      throw invalid;
    }

    return this.issueTokens(user);
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
        permissions: [...permissions],
      },
    };
  }
}
