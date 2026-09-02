import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppStatus, Prisma } from '../generated/prisma/client';
import { OrgContext } from '../org/org-context';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';

/**
 * SUPERADMIN КОНСОЛЫН SERVICE (Prompt 5).
 *
 * Энд л org-scope bypass ЗӨВШӨӨРӨГДӨНӨ: superadmin бүх байгууллагыг
 * харах нь энэ консолын мөн чанар. Route бүр SuperAdminGuard-тай тул
 * bypass нь зөвхөн isSuperAdmin хэрэглэгчид хүрнэ.
 */
@Injectable()
export class PlatformAdminService {
  constructor(private readonly prisma: PrismaService) {}

  /** Бүх байгууллага: хэрэглэгчийн тоо, идэвхтэй app, статустай */
  listOrganizations(search?: string) {
    return OrgContext.runBypassed(async () => {
      const orgs = await this.prisma.organization.findMany({
        where: search
          ? { name: { contains: search, mode: 'insensitive' } }
          : undefined,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          phone: true,
          isActive: true,
          createdAt: true,
        },
      });
      const [userCounts, appRows] = await Promise.all([
        this.prisma.user.groupBy({
          by: ['organizationId'],
          _count: { id: true },
        }),
        this.prisma.organizationApp.findMany({
          select: {
            organizationId: true,
            application: { select: { key: true, nameMn: true } },
          },
        }),
      ]);
      const usersBy = new Map(
        userCounts.map((u) => [u.organizationId, u._count.id]),
      );
      const appsBy = new Map<string, { key: string; nameMn: string }[]>();
      for (const r of appRows) {
        const list = appsBy.get(r.organizationId) ?? [];
        list.push(r.application);
        appsBy.set(r.organizationId, list);
      }
      return orgs.map((o) => ({
        ...o,
        userCount: usersBy.get(o.id) ?? 0,
        apps: appsBy.get(o.id) ?? [],
      }));
    });
  }

  /** Платформын тоон үзүүлэлт */
  stats() {
    return OrgContext.runBypassed(async () => {
      const [organizations, users, activeApps] = await Promise.all([
        this.prisma.organization.count(),
        this.prisma.user.count(),
        this.prisma.application.count({
          where: { status: AppStatus.ACTIVE },
        }),
      ]);
      return { organizations, users, activeApps };
    });
  }

  private async setOrgActive(id: string, isActive: boolean) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Байгууллага олдсонгүй');
    await this.prisma.organization.update({ where: { id }, data: { isActive } });
    return { ok: true, id, isActive };
  }

  /** Түдгэлзүүлэх — хэрэглэгчид нь нэвтрэх/refresh хийхэд ойлгомжтой алдаа авна */
  suspend(id: string) {
    return this.setOrgActive(id, false);
  }

  activate(id: string) {
    return this.setOrgActive(id, true);
  }

  /** Каталогийн бүрэн жагсаалт (DISABLED-ийг оруулаад) */
  listAllApps() {
    return this.prisma.application.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createApp(dto: CreateApplicationDto) {
    try {
      return await this.prisma.application.create({
        data: {
          key: dto.key,
          nameMn: dto.nameMn,
          nameEn: dto.nameEn,
          descriptionMn: dto.descriptionMn,
          icon: dto.icon,
          color: dto.color,
          status: dto.status ?? AppStatus.COMING_SOON,
          sortOrder: dto.sortOrder ?? 100,
        },
      });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') {
        throw new BadRequestException('Ийм key-тэй app бүртгэлтэй байна');
      }
      throw e;
    }
  }

  /**
   * App засах. KEY ӨӨРЧЛӨГДӨХГҮЙ — frontend манифест, идэвхжүүлэлтүүд
   * key-ээр холбогддог тул production-д орсон key солих нь бүх
   * холболтыг таслана (DTO-д key талбар огт байхгүйгээр хамгаалагдсан).
   */
  async updateApp(id: string, dto: UpdateApplicationDto) {
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('App олдсонгүй');
    const data: Prisma.ApplicationUpdateInput = {};
    if (dto.nameMn !== undefined) data.nameMn = dto.nameMn;
    if (dto.nameEn !== undefined) data.nameEn = dto.nameEn;
    if (dto.descriptionMn !== undefined) data.descriptionMn = dto.descriptionMn;
    if (dto.icon !== undefined) data.icon = dto.icon;
    if (dto.color !== undefined) data.color = dto.color;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    return this.prisma.application.update({ where: { id }, data });
  }
}
