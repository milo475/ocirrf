import { Injectable, NotFoundException } from '@nestjs/common';
import { Observable, Subject, finalize, interval, map, merge } from 'rxjs';
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

/** SSE мессеж — data нь JSON string */
export type SseEvent = { data: string };

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  /**
   * SSE холболтууд (V4-09): хэрэглэгч бүрд нэгээс олон tab байж болно.
   * In-memory — server restart-д холболтууд тасарч frontend дахин холбогдоно.
   */
  private readonly streams = new Map<string, Set<Subject<SseEvent>>>();

  /** Нэг хэрэглэгчийн SSE stream — 25с тутамд ping (proxy timeout-аас сэргийлнэ) */
  subscribe(userId: string): Observable<SseEvent> {
    const subj = new Subject<SseEvent>();
    let set = this.streams.get(userId);
    if (!set) {
      set = new Set();
      this.streams.set(userId, set);
    }
    set.add(subj);

    const heartbeat = interval(25_000).pipe(
      map((): SseEvent => ({ data: '{"type":"ping"}' })),
    );
    return merge(subj.asObservable(), heartbeat).pipe(
      finalize(() => {
        set.delete(subj);
        if (set.size === 0) this.streams.delete(userId);
      }),
    );
  }

  /** Холбогдсон хэрэглэгчид шинэ unread тоог push хийнэ */
  private async pushUnread(userId: string) {
    const set = this.streams.get(userId);
    if (!set || set.size === 0) return;
    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    const evt: SseEvent = {
      data: JSON.stringify({ type: 'notification', unreadCount }),
    };
    for (const subj of set) subj.next(evt);
  }

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
    // Real-time push (V4-09) — push бүтэхгүй байсан ч мэдэгдэл үүссэн байна
    await Promise.all(
      [...new Set(userIds)].map((id) =>
        this.pushUnread(id).catch(() => undefined),
      ),
    );
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

  /** Онлайн (customer) захиалга үүсэхэд — OPERATOR/MANAGER-үүдэд */
  async notifyCustomerOrder(order: { id: string; orderNo: string }) {
    const staff = await this.prisma.user.findMany({
      where: {
        role: { in: [Role.OPERATOR, Role.MANAGER] },
        isActive: true,
      },
      select: { id: true },
    });
    await this.notify(
      staff.map((u) => u.id),
      {
        type: 'CUSTOMER_ORDER',
        title: `Шинэ онлайн захиалга: ${order.orderNo}`,
        refType: 'order',
        refId: order.id,
      },
    );
  }

  /** Захиалгын статус өөрчлөгдөхөд — тухайн customer-т */
  async notifyOrderStatus(
    customerId: string,
    order: { id: string; orderNo: string; orderStatus: string },
  ) {
    const STATUS_MN: Record<string, string> = {
      NEW: 'Шинэ',
      CONFIRMED: 'Баталгаажсан',
      PREPARING: 'Бэлтгэж буй',
      READY: 'Бэлэн',
      COMPLETED: 'Хүргэгдсэн',
      CANCELLED: 'Цуцлагдсан',
    };
    await this.notify([customerId], {
      type: 'ORDER_STATUS',
      title: `Захиалга ${order.orderNo}: ${STATUS_MN[order.orderStatus] ?? order.orderStatus}`,
      refType: 'order',
      refId: order.id,
    });
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
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
    // Бусад tab-ын badge шууд буурна (V4-09)
    await this.pushUnread(userId).catch(() => undefined);
    return updated;
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    await this.pushUnread(userId).catch(() => undefined);
    return { ok: true };
  }
}
