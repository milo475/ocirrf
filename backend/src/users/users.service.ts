import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { DeliveryStatus } from '../generated/prisma/client';
import { PermissionsService } from '../permissions/permissions.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    (e as { code?: string }).code === 'P2002'
  );
}

/** passwordHash-ыг хэзээ ч буцаахгүй; DriverProfile байвал хамт */
const SAFE_SELECT = {
  id: true,
  username: true,
  fullName: true,
  role: true,
  isActive: true,
  createdAt: true,
  lastLoginAt: true,
  lockedUntil: true,
  driverProfile: {
    select: {
      feePerDelivery: true,
      vehicleInfo: true,
      employmentType: true,
      isAvailable: true,
      zones: true,
    },
  },
  company: { select: { id: true, name: true } },
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  findAll(query: QueryUsersDto) {
    return this.prisma.user.findMany({
      where: {
        ...(query.role ? { role: query.role } : {}),
        ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      },
      select: SAFE_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            username: dto.email, // email хэлбэрийн утга username талбарт
            fullName: dto.name,
            companyId: dto.companyId,
            passwordHash,
            role: dto.role,
          },
        });

        // Жолоочид profile-ыг зэрэг үүсгэнэ (feePerDelivery DTO-д ValidateIf-ээр заавал)
        if (dto.role === 'DRIVER') {
          await tx.driverProfile.create({
            data: {
              userId: user.id,
              feePerDelivery: dto.feePerDelivery!,
              vehicleInfo: dto.vehicleInfo,
              employmentType: dto.employmentType ?? 'FULL_TIME',
              zones: dto.zones ?? [],
            },
          });
        }

        return tx.user.findUnique({
          where: { id: user.id },
          select: SAFE_SELECT,
        });
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('Ийм имэйлтэй хэрэглэгч бүртгэлтэй байна');
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateUserDto, currentUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { driverProfile: true },
    });
    if (!user) {
      throw new NotFoundException('Хэрэглэгч олдсонгүй');
    }

    // Өөрийгөө хамгаалах дүрмүүд
    if (id === currentUserId) {
      if (dto.isActive === false) {
        throw new BadRequestException('Өөрийгөө идэвхгүй болгох боломжгүй');
      }
      if (dto.role && dto.role !== user.role) {
        throw new BadRequestException('Өөрийн эрхийг өөрчлөх боломжгүй');
      }
    }

    const becomingDriver = dto.role === 'DRIVER' && user.role !== 'DRIVER';
    const leavingDriver =
      user.role === 'DRIVER' && !!dto.role && dto.role !== 'DRIVER';

    if (leavingDriver) {
      const active = await this.prisma.order.count({
        where: {
          assignedDriverId: id,
          deliveryStatus: {
            in: [DeliveryStatus.ASSIGNED, DeliveryStatus.ON_THE_WAY],
          },
        },
      });
      if (active > 0) {
        throw new BadRequestException(
          'Дуусаагүй хүргэлттэй жолоочийн эрхийг өөрчлөх боломжгүй',
        );
      }
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.fullName = dto.name;
    if (dto.companyId !== undefined) data.companyId = dto.companyId;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.password !== undefined) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data });

      // Идэвхгүй болгоход бүх refresh token шууд унтарна (V4-08)
      if (dto.isActive === false) {
        await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      const willBeDriver = (dto.role ?? user.role) === 'DRIVER';
      const profileTouched =
        dto.feePerDelivery !== undefined ||
        dto.vehicleInfo !== undefined ||
        dto.employmentType !== undefined ||
        dto.zones !== undefined;

      // DRIVER болж байгаад profile байхгүй бол үүсгэнэ;
      // байгаа жолоочийн хөлс/тээврийг шинэчилнэ
      if (willBeDriver && (becomingDriver || profileTouched)) {
        await tx.driverProfile.upsert({
          where: { userId: id },
          update: {
            ...(dto.feePerDelivery !== undefined
              ? { feePerDelivery: dto.feePerDelivery }
              : {}),
            ...(dto.zones !== undefined ? { zones: dto.zones } : {}),
            ...(dto.employmentType !== undefined
              ? { employmentType: dto.employmentType }
              : {}),
            ...(dto.vehicleInfo !== undefined
              ? { vehicleInfo: dto.vehicleInfo }
              : {}),
          },
          create: {
            userId: id,
            feePerDelivery: dto.feePerDelivery ?? '0.00',
            vehicleInfo: dto.vehicleInfo,
          },
        });
      }

      return tx.user.findUnique({ where: { id }, select: SAFE_SELECT });
    });

    // Permission cache нь userId-оор түлхүүрлэгддэг ч утга нь role-оос
    // хамаардаг: эрх солигдоход шууд цэвэрлэнэ, эс тэгвэл хуучин role-ийн
    // permission 60 секунд хүртэл хүчинтэй хэвээр үлдэнэ.
    if (dto.role !== undefined && dto.role !== user.role) {
      this.permissions.invalidate(id);
    }
    return result;
  }

  /**
   * Нууц үг сэргээх (V4-06): 8 тэмдэгт түр нууц үг үүсгэж НЭГ УДАА
   * хариунд буцаана — DB-д зөвхөн hash. mustChangePassword=true тул
   * хэрэглэгч солитол бусад API-д 403 (PasswordChangeGuard).
   * ActivityLog interceptor үйлдлийг бичнэ — түр нууц үг response-д тул
   * лог руу ОРОХГҮЙ.
   */
  async resetPassword(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Хэрэглэгч олдсонгүй');
    }
    // Төстэй харагддаг тэмдэгтгүй (0/O, 1/l/I) цагаан толгой
    const alphabet =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const tempPassword = Array.from(randomBytes(8))
      .map((b) => alphabet[b % alphabet.length])
      .join('');

    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: await bcrypt.hash(tempPassword, 10),
        mustChangePassword: true,
      },
    });
    // Бүх refresh token шууд унтарна (V4-08) — идэвхтэй session тасарна
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { tempPassword };
  }

  /** Түгжээ тайлах (V4-07) — counter 0, lockedUntil арилна */
  async unlock(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Хэрэглэгч олдсонгүй');
    }
    return this.prisma.user.update({
      where: { id },
      data: { failedLoginCount: 0, lockedUntil: null },
      select: SAFE_SELECT,
    });
  }
}
