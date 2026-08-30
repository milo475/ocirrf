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
    // Хүлээн авагчид олон эх сурвалжаас нийлдэг (ж: ADMIN бөгөөд
    // борлуулагч) — давхардвал нэг хүнд хоёр мөр үүсч хонх худал
    // тоолно
    const targets = [...new Set(userIds)];
    if (targets.length === 0) return;
    await this.prisma.notification.createMany({
      data: targets.map((userId) => ({
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
      targets.map((id) => this.pushUnread(id).catch(() => undefined)),
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



  /** Идэвхтэй тодорхой эрхтэй хэрэглэгчдийн id */
  private async activeByRole(roles: Role[]): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: { role: { in: roles }, isActive: true },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  /**
   * Нийтийн линкээр хүсэлт ирэхэд — БОРЛУУЛАГЧ нарт (V5).
   * Хүсэлт хүлээж авах нь борлуулагчийн ажил тул хонх тэдэн дээр
   * дуугарна. Борлуулагч бүртгэгдээгүй бол хүсэлт хаясан газраа
   * үлдэхгүйн тулд ADMIN/MANAGER руу унана.
   */
  async notifyOrderRequest(request: {
    id: string;
    customerName: string;
    phone: string;
    socialName: string | null;
  }) {
    let targets = await this.activeByRole([Role.SELLER]);
    if (targets.length === 0) {
      targets = await this.activeByRole([Role.ADMIN, Role.MANAGER]);
    }
    await this.notify(targets, {
      type: 'ORDER_REQUEST',
      title: `Шинэ захиалгын хүсэлт: ${request.customerName}`,
      body: `${request.phone}${request.socialName ? ` · ${request.socialName}` : ''}`,
      refType: 'order-request',
      refId: request.id,
    });
  }

  /**
   * Захиалга ХҮРГЭЛТЭД ГАРАХАД — нярав болон менежерүүдэд (V5).
   *
   * Борлуулагч хэрэглэгчийн мэдээллийг шалгаж, жолооч хуваарилмагц
   * дуудагдана. Нярав энэ мэдээллээр тооцоо/төлөвлөлтөө хийнэ, менежер
   * хяналтаа тавина — тиймээс хаяг, бараа, дүн, ӨМНӨХ ХУДАЛДАН АВАЛТЫН
   * түүхийг мэдэгдлийн биед шууд оруулна (хонх дээрээс нээхгүйгээр
   * харагдана).
   */
  async notifyReleasedToDelivery(input: {
    orderId: string;
    orderNo: string;
    customerName: string | null;
    phone: string;
    address: string;
    items: string;
    total: string;
    driverName: string;
    priorOrders: number;
    priorAmount: string;
  }) {
    const targets = await this.activeByRole([
      Role.WAREHOUSE,
      Role.MANAGER,
      Role.ADMIN,
    ]);
    const history =
      input.priorOrders > 0
        ? `Өмнө нь ${input.priorOrders} захиалга · ${input.priorAmount}`
        : 'Анхны худалдан авалт';
    await this.notify(targets, {
      type: 'ORDER_RELEASED',
      title: `Хүргэлтэд гарлаа: ${input.orderNo} → ${input.driverName}`,
      body: [
        `${input.customerName ?? ''} · ${input.phone}`,
        input.address,
        `${input.items} · ${input.total}`,
        history,
      ]
        .filter(Boolean)
        .join('\n'),
      refType: 'order',
      refId: input.orderId,
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

  /**
   * Хүргэлт амжилтгүй болоход — ADMIN/MANAGER-ээс ГАДНА БОРЛУУЛАГЧид (V5).
   *
   * Хэрэглэгчтэй IG/FB дээр ЯРЬДАГ нь борлуулагч. Өмнө нь мэдэгдэл
   * зөвхөн удирдлагад очдог тул «яагаад ирээгүй юм бэ?» гэсэн асуултад
   * борлуулагч хариулж чадахгүй, менежерээс асуух хэрэгтэй болдог байв.
   * Дахин жолооч хуваарилах эрх нь мөн борлуулагчид байдаг.
   */
  async notifyDeliveryFailed(
    order: {
      id: string;
      orderNo: string;
      customerName?: string | null;
      phone?: string;
    },
    reason: string,
  ) {
    const [staff, sellers] = await Promise.all([
      this.staffWithPermission(),
      this.activeByRole([Role.SELLER]),
    ]);
    const who = [order.customerName, order.phone].filter(Boolean).join(' · ');
    await this.notify([...staff, ...sellers], {
      type: 'DELIVERY_FAILED',
      title: `Хүргэлт амжилтгүй: ${order.orderNo}`,
      body: who ? `${who}\n${reason}` : reason,
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
