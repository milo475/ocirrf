import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '../generated/prisma/client';
import { PERM } from '../permissions/permission-keys';
import { PermissionsService } from '../permissions/permissions.service';
import { PrismaService } from '../prisma/prisma.service';

export type NotifyData = {
  type: string;
  title: string;
  body?: string;
  refType?: string;
  refId?: string;
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  /** Олон хэрэглэгчид нэг мэдэгдэл */
  async notify(userIds: string[], data: NotifyData) {
    if (userIds.length === 0) return;
    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: data.type,
        title: data.title,
        body: data.body ?? null,
        refType: data.refType ?? null,
        refId: data.refId ?? null,
      })),
    });
  }

  /** Тухайн permission-тэй идэвхтэй ADMIN/MANAGER-үүдийн id */
  private async staffWithPermission(permKey?: string): Promise<string[]> {
    const staff = await this.prisma.user.findMany({
      where: { role: { in: [Role.ADMIN, Role.MANAGER] }, isActive: true },
      select: { id: true, role: true },
    });
    if (!permKey) return staff.map((u) => u.id);
    const out: string[] = [];
    for (const u of staff) {
      if (await this.permissions.has(u.id, u.role, permKey as never)) {
        out.push(u.id);
      }
    }
    return out;
  }

  /** Захиалга хуваарилагдахад — жолоочид */
  async notifyDriverAssigned(driverId: string, order: { id: string; orderNo: string }) {
    await this.notify([driverId], {
      type: 'DELIVERY_ASSIGNED',
      title: `Шинэ хүргэлт: ${order.orderNo}`,
      refType: 'order',
      refId: order.id,
    });
  }

  /** Хүргэлт амжилтгүй болоход — ADMIN/MANAGER-үүдэд */
  async notifyDeliveryFailed(
    order: { id: string; orderNo: string },
    reason: string,
  ) {
    const staff = await this.staffWithPermission();
    await this.notify(staff, {
      type: 'DELIVERY_FAILED',
      title: `Хүргэлт амжилтгүй: ${order.orderNo}`,
      body: reason,
      refType: 'order',
      refId: order.id,
    });
  }

  /**
   * Бараа лимитээс ДООШ ОРОХ МӨЧИД — inventory.view эрхтэй
   * ADMIN/MANAGER-үүдэд. Нэг бараанд өдөрт 1-ээс олон илгээхгүй.
   */
  async notifyLowStock(product: {
    id: string;
    name: string;
    stockQty: number;
    lowStockLimit: number;
  }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dup = await this.prisma.notification.findFirst({
      where: {
        type: 'LOW_STOCK',
        refId: product.id,
        createdAt: { gte: today },
      },
      select: { id: true },
    });
    if (dup) return;

    const staff = await this.staffWithPermission(PERM.INVENTORY_VIEW);
    await this.notify(staff, {
      type: 'LOW_STOCK',
      title: `Үлдэгдэл бага: ${product.name}`,
      body: `${product.stockQty}ш үлдлээ (доод хязгаар ${product.lowStockLimit})`,
      refType: 'product',
      refId: product.id,
    });
  }

  // ── Хэрэглэгчийн endpoint-ууд (зөвхөн өөрийнх) ──

  async list(userId: string, unread: boolean | undefined, page = 1, limit = 20) {
    const where = { userId, ...(unread ? { isRead: false } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  async markRead(userId: string, id: string) {
    const n = await this.prisma.notification.findUnique({ where: { id } });
    if (!n || n.userId !== userId) {
      throw new NotFoundException('Мэдэгдэл олдсонгүй');
    }
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { ok: true };
  }
}
