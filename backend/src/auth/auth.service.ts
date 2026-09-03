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
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Role } from '../generated/prisma/client';
import type { User } from '../generated/prisma/client';
import { OrgContext } from '../org/org-context';
import { PermissionsService } from '../permissions/permissions.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterOrgDto } from './dto/register-org.dto';
import { SecurityLogService } from '../activity-log/security-log.service';
import { describeUserAgent } from './user-agent.util';

export type JwtPayload = { sub: string; role: string; jti?: string };

const REFRESH_TTL_MS = 7 * 24 * 60 * 60_000; // 7 хоног — token-ий expiresIn-тэй ижил

/**
 * Бүртгэлгүй имэйлд ч bcrypt ажиллуулахад зориулсан hash: байхгүй
 * хэрэглэгчийн хариу шууд, байгаагийнх ~100мс удаан ирдэг байсан нь
 * хугацааны ялгаагаар бүртгэлтэй имэйл таах боломж олгож байв.
 */
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer', 10);

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly permissionsService: PermissionsService,
    private readonly securityLog: SecurityLogService,
  ) {}

  /**
   * @param ip Хүсэлт хаанаас ирснийг аюулгүй байдлын бүртгэлд
   *   тэмдэглэнэ — довтолгоо нэг эх сурвалжаас ирж буйг таних гол
   *   мэдээлэл.
   */
  async login(
    dto: LoginDto,
    ip: string | null = null,
    userAgent: string | null = null,
  ) {
    // Байгууллага ХАРААХАН тогтоогдоогүй үе (Multi-tenancy) — нэвтрэлт
    // өөрөө л байгууллагыг тодорхойлдог тул bypass-аар ажиллана
    return OrgContext.runBypassed(() => this.loginImpl(dto, ip, userAgent));
  }

  private async loginImpl(
    dto: LoginDto,
    ip: string | null,
    userAgent: string | null,
  ) {
    // User.username талбарт email хэлбэрийн утга хадгалагддаг (seed-ийн дагуу)
    const user = await this.prisma.user.findUnique({
      where: { username: dto.email },
    });

    // Аль шалтгаанаар амжилтгүй болсныг ялгаж мэдэгдэхгүй
    const invalid = new UnauthorizedException('Нэвтрэх мэдээлэл буруу');

    if (!user) {
      await bcrypt.compare(dto.password, DUMMY_HASH);
    }
    if (!user || !user.isActive) {
      // Бүртгэлгүй/идэвхгүй хаягаар оролдсон нь ч дохио
      await this.securityLog.loginFailed(
        dto.email,
        ip,
        user?.id ?? null,
        user?.organizationId ?? null,
      );
      throw invalid;
    }

    // Түгжээ (V4-07): хугацаа дуустал ЗӨВ нууц үг ч нэвтрэхгүй
    const locked = new HttpException(
      'Бүртгэл түр түгжигдлээ (15 мин)',
      HttpStatus.LOCKED,
    );
    const isLocked = Boolean(user.lockedUntil && user.lockedUntil > new Date());

    /**
     * НУУЦ ҮГИЙГ ТҮГЖЭЭНЭЭС ӨМНӨ ШАЛГАНА (V5 засвар — данс задрахаас).
     *
     * Өмнө нь түгжээг нууц үг шалгахаас ӨМНӨ шалгаад 423 шиддэг байсан.
     * Байхгүй хаяг үргэлж 401 өгдөг тул сүлжээнээс харагдах ялгаа нь
     * "энэ хаяг бүртгэлтэй юу?" гэдгийг шууд хэлдэг байв: сонирхсон
     * хаягруу 5 хог нууц үг илгээгээд 423 ирвэл бүртгэлтэй, 401 хэвээр
     * бол үгүй. Мөн яг тэр 5 хүсэлт (IP-ийн лимиттэй ижил тоо) нэрлэсэн
     * ADMIN-ыг 15 минут гаргалгүй хаадаг байсан.
     *
     * Одоо БУРУУ нууц үгэнд ҮРГЭЛЖ 401 буцна — түгжигдсэн эсэхээс үл
     * хамааран. 423 нь зөвхөн нууц үг нь ЗӨВ үед л гарна, өөрөөр хэлбэл
     * жинхэнэ эзэн нь л түгжигдсэнээ мэдэх бөгөөд гуравдагч этгээд
     * ямар ч ялгаа хардаггүй. (Тэмдэглэл: түгжээ өөрөө хаягийг мэддэг
     * этгээдэд DoS хэвээр — үүнийг арилгахад IP/бүртгэл хосолсон
     * backoff хэрэгтэй, энэ нь тусдаа өөрчлөлт.)
     */
    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) {
      // Аль хэдийн түгжигдсэн бол тоолуурыг цаашид өсгөхгүй — эс тэгвэл
      // халдагч түгжээг төгсгөлгүй сунгаж чадна.
      if (!isLocked) {
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
        if (willLock) {
          await this.securityLog.loginLocked(
            dto.email,
            ip,
            user.id,
            user.organizationId,
          );
          throw invalid;
        }
      }
      await this.securityLog.loginFailed(
        dto.email,
        ip,
        user.id,
        user.organizationId,
      );
      throw invalid;
    }

    // Нууц үг ЗӨВ атал түгжигдсэн — зөвхөн энд 423 мэдэгдэнэ
    if (isLocked) {
      await this.securityLog.loginFailed(
        dto.email,
        ip,
        user.id,
        user.organizationId,
      );
      throw locked;
    }

    /**
     * Байгууллагын түдгэлзүүлэлт (SUPERADMIN, Prompt 5): түдгэлзсэн
     * байгууллагын хэрэглэгч ЗӨВ нууц үгтэй ч нэвтрэхгүй — учир
     * шалтгааныг нь ойлгомжтой хэлнэ (нууц үг буруутай андуурахгүй).
     */
    const org = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { isActive: true },
    });
    if (org && !org.isActive) {
      throw new HttpException(
        'Танай байгууллагын эрх түдгэлзсэн байна',
        HttpStatus.FORBIDDEN,
      );
    }

    // Амжилттай: counter 0, түгжээ арилж, lastLoginAt шинэчлэгдэнэ
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    /**
     * Нэвтрэлтийн түүх (V5) — «хаанаас, ямар төхөөрөмжөөр орсон»,
     * «миний бүртгэлээр өөр хүн орсон уу» гэдэгт хариулна.
     * fire-and-forget: бүртгэл амжилтгүй болсон ч нэвтрэлт саадгүй.
     */
    void this.prisma.loginHistory
      .create({ data: { userId: user.id, ip, userAgent } })
      .catch(() => undefined);

    return this.issueTokens(updated);
  }

  /**
   * БАЙГУУЛЛАГЫН НЭЭЛТТЭЙ БҮРТГЭЛ (Multi-tenancy). Байгууллага + эхний
   * ADMIN хэрэглэгч + companyName тохиргоо нэг transaction-д үүсээд
   * шууд нэвтэрсэн төлөвт орно (login-той ижил хариу).
   *
   * Байгууллагын нэр САНААТАЙГААР unique биш: нэрээр таах/enumeration
   * боломж өгөхгүй, ижил нэртэй хоёр компани байж болно.
   */
  async registerOrganization(dto: RegisterOrgDto) {
    const email = dto.email.trim().toLowerCase();

    // Имэйл глобал unique — байгууллага тогтоогдоогүй үе тул bypass
    return OrgContext.runBypassed(async () => {
      const existing = await this.prisma.user.findUnique({
        where: { username: email },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException('Энэ и-мэйл бүртгэлтэй байна');
      }

      const passwordHash = await bcrypt.hash(dto.password, 10);
      const user = await this.prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: {
            name: dto.orgName.trim(),
            phone: dto.phone?.trim() || null,
            // Нийтийн захиалгын линк шинэ байгууллагад шууд бэлэн
            // (order-requests.service-ийн token-той ижил хэлбэр, 128 бит)
            publicOrderToken: randomBytes(16).toString('base64url'),
          },
        });
        try {
          const admin = await tx.user.create({
            data: {
              username: email,
              passwordHash,
              fullName: dto.fullName.trim(),
              role: Role.ADMIN,
              organizationId: org.id,
            },
          });
          await tx.setting.create({
            data: {
              organizationId: org.id,
              key: 'companyName',
              value: dto.orgName.trim(),
            },
          });
          if (dto.phone?.trim()) {
            await tx.setting.create({
              data: {
                organizationId: org.id,
                key: 'companyPhone',
                value: dto.phone.trim(),
              },
            });
          }
          // Цөм "ursgal" app шинэ байгууллагад автоматаар идэвхжинэ
          // (App Registry) — каталогт байхгүй онцгой орчинд алгасна
          const ursgal = await tx.application.findUnique({
            where: { key: 'ursgal' },
            select: { id: true },
          });
          if (ursgal) {
            await tx.organizationApp.create({
              data: { organizationId: org.id, applicationId: ursgal.id },
            });
          }
          return admin;
        } catch (e) {
          // Зэрэг илгээсэн давхар бүртгэлийн уралдаан — P2002
          if ((e as { code?: string }).code === 'P2002') {
            throw new ConflictException('Энэ и-мэйл бүртгэлтэй байна');
          }
          throw e;
        }
      });

      return this.issueTokens(user);
    });
  }

  /**
   * Refresh + ROTATION (V4-08): хуучин token revoke хийгдэж шинэ хос
   * олгогдоно. Revoke-логдсон token ДАХИН ирвэл — хулгайн шинж —
   * хэрэглэгчийн БҮХ token унтарна.
   */
  async refresh(dto: RefreshDto) {
    // Login-той ижил: байгууллага тогтоогдохоос өмнөх зам — bypass
    return OrgContext.runBypassed(() => this.refreshImpl(dto));
  }

  private async refreshImpl(dto: RefreshDto) {
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

    /**
     * ТОКЕНЫГ ЭНД АТОМООР ЭЗЭМШИНЭ (V5 засвар).
     *
     * Өмнө нь дээрх `revokedAt === null` шалгалт нь энгийн уншилт байсан
     * бөгөөд revoke нь хамаагүй хожим, шинэ токен гаргасны ДАРАА
     * бичигддэг байв. Тиймээс хулгайлагдсан refresh token-ыг жинхэнэ
     * клиенттэй ЗЭРЭГ хэрэглэхэд хоёулаа шалгалтыг давж, хоёр хүчинтэй
     * гэр бүл үүсдэг байсан — «дахин ашиглалт илэрвэл бүх токеныг
     * хүчингүй болгоно» гэсэн хамгаалалт хэзээ ч ажиллахгүй.
     *
     * `updateMany` нь `revokedAt: null` нөхцөлтэй тул зөвхөн НЭГ хүсэлт
     * 1 мөр өөрчилнө; хоёр дахь нь 0 авч, дахин ашиглалт гэж үзэгдэн
     * гэр бүлээрээ хүчингүй болно.
     */
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: payload.jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claimed.count === 0) {
      await this.revokeAllTokens(record.userId);
      throw invalid;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !user.isActive) {
      throw invalid;
    }

    // Түдгэлзсэн байгууллагын session refresh-ээр сунгагдахгүй (Prompt 5)
    const org = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { isActive: true },
    });
    if (org && !org.isActive) {
      throw new HttpException(
        'Танай байгууллагын эрх түдгэлзсэн байна',
        HttpStatus.FORBIDDEN,
      );
    }

    // Хугацаа дууссан token-уудыг энд дайрч цэвэрлэнэ (өдөр тутмын cleanup)
    await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    const tokens = await this.issueTokens(user);
    // `revokedAt` нь дээрх атом эзэмшилд аль хэдийн тавигдсан — энд зөвхөн
    // сүлжээг (гэр бүлийн хэлхээг) бүрдүүлэх заалтыг нэмнэ.
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { replacedById: tokens.refreshJti },
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

  /**
   * Хэрэглэгчийн сүүлийн нэвтрэлтүүд.
   * Өөрийнхөө түүхийг хэн ч харна — «энэ би мөн үү» гэдгийг зөвхөн
   * тухайн хүн мэднэ. Бусдынхыг харах нь users.manage эрхийн ажил
   * (controller дээр шалгагдана).
   */
  async loginHistory(userId: string, limit = 20) {
    const rows = await this.prisma.loginHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });
    return rows.map((r) => ({
      id: r.id,
      at: r.createdAt,
      ip: r.ip,
      device: describeUserAgent(r.userAgent),
    }));
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

    // Байгууллагын нэр — frontend-ийн topbar-т (Organization scoped биш)
    const organization = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { name: true },
    });

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
        organizationId: user.organizationId,
        organizationName: organization?.name ?? null,
        isSuperAdmin: user.isSuperAdmin,
        mustChangePassword: user.mustChangePassword,
        lastLoginAt: user.lastLoginAt,
        companyId: user.companyId,
        permissions: [...permissions],
      },
    };
  }
}
