import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppStatus } from '../generated/prisma/client';
import { OrgContext } from '../org/org-context';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Цөм app — унтраах боломжгүй: сүүлчийн app-аа унтраасан байгууллага
 * launcher дээрээ юу ч харахгүй мухардана.
 */
const CORE_APP_KEY = 'ursgal';

/**
 * ПЛАТФОРМЫН APP REGISTRY (Odoo маягийн олон системийн каталог).
 *
 * Application нь глобал model (org-scope extension үйлчилдэггүй) тул
 * нэвтрэлтгүй нүүр хуудсанд ч уншигдана. OrganizationApp нь org-scoped —
 * my-apps нь extension-ээр автоматаар нэвтэрсэн хэрэглэгчийн
 * байгууллагад хязгаарлагдана.
 */
@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  /** Нүүр хуудасны каталог: ACTIVE + COMING_SOON, эрэмбээрээ */
  listPublicApps() {
    return this.prisma.application.findMany({
      where: { status: { in: [AppStatus.ACTIVE, AppStatus.COMING_SOON] } },
      orderBy: [{ sortOrder: 'asc' }, { nameMn: 'asc' }],
      select: {
        key: true,
        nameMn: true,
        nameEn: true,
        descriptionMn: true,
        icon: true,
        color: true,
        status: true,
        sortOrder: true,
      },
    });
  }

  /** Нэвтэрсэн хэрэглэгчийн байгууллагад идэвхтэй app-ууд */
  async myApps() {
    const rows = await this.prisma.organizationApp.findMany({
      include: { application: true },
      orderBy: { application: { sortOrder: 'asc' } },
    });
    return rows
      // Каталогоос DISABLED болгосон app идэвхжүүлэлттэй ч харагдахгүй
      .filter((r) => r.application.status === AppStatus.ACTIVE)
      .map((r) => ({
        key: r.application.key,
        nameMn: r.application.nameMn,
        nameEn: r.application.nameEn,
        descriptionMn: r.application.descriptionMn,
        icon: r.application.icon,
        color: r.application.color,
        sortOrder: r.application.sortOrder,
        enabledAt: r.enabledAt,
      }));
  }

  /**
   * Байгууллагадаа app идэвхжүүлнэ (platform.manage_apps).
   * Зөвхөн ACTIVE статустай app; давхар идэвхжүүлэлт idempotent.
   */
  async enableApp(key: string, userId: string) {
    const app = await this.prisma.application.findUnique({ where: { key } });
    if (!app || app.status !== AppStatus.ACTIVE) {
      throw new BadRequestException(
        'Энэ app-ийг идэвхжүүлэх боломжгүй (идэвхтэй биш эсвэл олдсонгүй)',
      );
    }
    const organizationId = OrgContext.require();
    const row = await this.prisma.organizationApp.upsert({
      where: {
        organizationId_applicationId: {
          organizationId,
          applicationId: app.id,
        },
      },
      update: {},
      create: {
        organizationId,
        applicationId: app.id,
        enabledByUserId: userId,
      },
    });
    return { ok: true, key: app.key, enabledAt: row.enabledAt };
  }

  /** Байгууллагаасаа app-ийг идэвхгүй болгоно. Цөм app хамгаалагдсан. */
  async disableApp(key: string) {
    if (key === CORE_APP_KEY) {
      throw new BadRequestException(
        'Цөм «Урсгал» app-ийг унтраах боломжгүй — үндсэн ажлын орчин тул ' +
          'байгууллагад дор хаяж энэ app идэвхтэй байх ёстой.',
      );
    }
    const app = await this.prisma.application.findUnique({
      where: { key },
      select: { id: true },
    });
    if (!app) {
      throw new NotFoundException('App олдсонгүй');
    }
    // deleteMany — extension нь organizationId шүүлтээ автоматаар нэмнэ
    const res = await this.prisma.organizationApp.deleteMany({
      where: { applicationId: app.id },
    });
    if (res.count === 0) {
      throw new NotFoundException('Энэ app байгууллагад идэвхжээгүй байна');
    }
    return { ok: true, key };
  }
}
