import { Injectable } from '@nestjs/common';
import { AppStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
}
