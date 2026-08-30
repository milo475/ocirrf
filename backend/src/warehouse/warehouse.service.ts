import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import {
  DeliveryStatus,
  OrderStatus,
  Prisma,
  Role,
} from '../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

/** Хүлээлгэн өгөхөд бэлэн болсон захиалгын төлөвүүд */
const HANDOVER_READY: OrderStatus[] = [
  OrderStatus.PREPARING,
  OrderStatus.READY,
];

@Injectable()
export class WarehouseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Идэвхтэй няравууд — хуваарилах цонхонд */
  async keepers() {
    return this.prisma.user.findMany({
      where: { role: Role.WAREHOUSE, isActive: true },
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
    });
  }

  /** Захиалгуудыг няравт оноох (олноор) — менежер хийнэ */
  async assign(orderIds: string[], warehouseId: string) {
    const keeper = await this.prisma.user.findUnique({
      where: { id: warehouseId },
    });
    if (!keeper || keeper.role !== Role.WAREHOUSE || !keeper.isActive) {
      throw new BadRequestException('Нярав олдсонгүй эсвэл идэвхгүй байна');
    }
    const { count } = await this.prisma.order.updateMany({
      where: {
        id: { in: orderIds },
        orderStatus: { in: [OrderStatus.CONFIRMED, ...HANDOVER_READY] },
      },
      data: { warehouseId },
    });
    if (count > 0) {
      await this.notifications.notify([warehouseId], {
        type: 'WAREHOUSE_ASSIGNED',
        title: `Бэлтгэх ${count} захиалга ирлээ`,
        refType: 'warehouse',
      });
    }
    return { assigned: count };
  }

  /**
   * Няравын ажлын самбар: жолооч тус бүрээр бүлэглэсэн захиалгууд.
   * Тухайн жолоочид ЯМАР БАРАА, ХЭД явахыг нэгтгэж харуулна —
   * агуулахаас нэг дор түүхэд зориулав.
   */
  async board(user: AuthUser, mineOnly = true) {
    const orders = await this.prisma.order.findMany({
      where: {
        orderStatus: { in: [OrderStatus.CONFIRMED, ...HANDOVER_READY] },
        handoverId: null,
        // mineOnly нь ЗӨВХӨН няравт утгатай — менежер/админ энэ
        // хуудсанд орвол (нярав ирээгүй өдөр) бүх бэлтгэлийг харна,
        // эс тэгвэл өөрт нь оноогдоогүй тул хоосон дэлгэц гарна
        ...(mineOnly && user.role === Role.WAREHOUSE
          ? { warehouseId: user.id }
          : {}),
      },
      include: {
        items: true,
        assignedDriver: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Жолоочоор бүлэглээд бараа нэгтгэнэ (хуваарилагдаагүй нь тусдаа)
    const groups = new Map<
      string,
      {
        driverId: string | null;
        driverName: string;
        orders: typeof orders;
        items: Map<string, { name: string; qty: number }>;
      }
    >();
    for (const o of orders) {
      const key = o.assignedDriverId ?? 'unassigned';
      if (!groups.has(key)) {
        groups.set(key, {
          driverId: o.assignedDriverId,
          driverName: o.assignedDriver?.fullName ?? 'Жолооч хуваарилаагүй',
          orders: [],
          items: new Map(),
        });
      }
      const g = groups.get(key)!;
      g.orders.push(o);
      for (const i of o.items) {
        const cur = g.items.get(i.productId) ?? { name: i.productName, qty: 0 };
        cur.qty += i.qty;
        g.items.set(i.productId, cur);
      }
    }

    return [...groups.values()].map((g) => ({
      driverId: g.driverId,
      driverName: g.driverName,
      orderCount: g.orders.length,
      readyCount: g.orders.filter((o) => o.orderStatus === OrderStatus.READY)
        .length,
      items: [...g.items.entries()]
        .map(([productId, v]) => ({ productId, ...v }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      orders: g.orders.map((o) => ({
        id: o.id,
        orderNo: o.orderNo,
        customerName: o.customerName,
        phone: o.phone,
        orderStatus: o.orderStatus,
        district: o.district,
        khoroo: o.khoroo,
        items: o.items.map((i) => ({
          productName: i.productName,
          qty: i.qty,
        })),
        note: o.note,
      })),
    }));
  }

  /**
   * Жолоочид хүлээлгэн өгөх хуудас үүсгэнэ. Хуудсанд орсон захиалгууд
   * READY болж, дахин өөр хуудсанд орохгүй (handoverId тавигдана).
   * Гарын үсгийг хэвлэсэн цаасан дээр нь гараар зурна.
   */
  async createHandover(
    dto: {
      driverId: string;
      orderIds: string[];
      note?: string;
    },
    user: AuthUser,
  ) {
    const driver = await this.prisma.user.findUnique({
      where: { id: dto.driverId },
    });
    if (!driver || driver.role !== Role.DRIVER) {
      throw new NotFoundException('Жолооч олдсонгүй');
    }

    const orders = await this.prisma.order.findMany({
      where: { id: { in: dto.orderIds } },
      select: {
        id: true,
        orderNo: true,
        orderStatus: true,
        handoverId: true,
        assignedDriverId: true,
      },
    });
    if (orders.length !== dto.orderIds.length) {
      throw new BadRequestException('Зарим захиалга олдсонгүй');
    }
    const already = orders.find((o) => o.handoverId);
    if (already) {
      throw new BadRequestException(
        `${already.orderNo} аль хэдийн хүлээлгэн өгсөн байна`,
      );
    }
    const wrongDriver = orders.find(
      (o) => o.assignedDriverId && o.assignedDriverId !== dto.driverId,
    );
    if (wrongDriver) {
      throw new BadRequestException(
        `${wrongDriver.orderNo} өөр жолоочид хуваарилагдсан байна`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Дугаар: ХҮЛ-YYYYMMDD-NNN (өдрийн дараалал)
      const now = new Date();
      const ymd = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
      ].join('');
      const prefix = `ХҮЛ-${ymd}-`;
      const todays = await tx.driverHandover.findMany({
        where: { number: { startsWith: prefix } },
        select: { number: true },
      });
      const next =
        todays.reduce((max, h) => {
          const n = parseInt(h.number.slice(prefix.length), 10);
          return Number.isFinite(n) && n > max ? n : max;
        }, 0) + 1;

      const handover = await tx.driverHandover.create({
        data: {
          number: prefix + String(next).padStart(3, '0'),
          driverId: dto.driverId,
          keeperId: user.id,
          note: dto.note?.trim() || null,
          handedAt: new Date(),
        },
      });

      // Захиалгууд хуудсанд холбогдож, гарахад бэлэн (READY) болно
      await tx.order.updateMany({
        where: { id: { in: dto.orderIds } },
        data: {
          handoverId: handover.id,
          orderStatus: OrderStatus.READY,
          assignedDriverId: dto.driverId,
          deliveryStatus: DeliveryStatus.ASSIGNED,
        },
      });

      return this.findHandover(handover.id, tx);
    });
  }

  /** Нэг хуудас — хэвлэхэд шаардлагатай бүх мэдээлэлтэй */
  async findHandover(id: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;
    const handover = await db.driverHandover.findUnique({
      where: { id },
      include: {
        driver: { select: { id: true, fullName: true } },
        keeper: { select: { id: true, fullName: true } },
        orders: {
          include: { items: true },
          orderBy: { orderNo: 'asc' },
        },
      },
    });
    if (!handover) {
      throw new NotFoundException('Хуудас олдсонгүй');
    }
    // Нэгтгэсэн барааны жагсаалт — хэвлэх хуудсанд
    const totals = new Map<string, { name: string; qty: number }>();
    for (const o of handover.orders) {
      for (const i of o.items) {
        const cur = totals.get(i.productId) ?? { name: i.productName, qty: 0 };
        cur.qty += i.qty;
        totals.set(i.productId, cur);
      }
    }
    return {
      ...handover,
      totals: [...totals.values()].sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  /** Хүлээлгэн өгсөн хуудсуудын түүх */
  async listHandovers(driverId?: string) {
    return this.prisma.driverHandover.findMany({
      where: driverId ? { driverId } : {},
      include: {
        driver: { select: { fullName: true } },
        keeper: { select: { fullName: true } },
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
