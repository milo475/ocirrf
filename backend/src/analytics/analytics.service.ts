import { Injectable } from '@nestjs/common';
import {
  DeliveryStatus,
  OrderStatus,
  Prisma,
  Role,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/** from/to → createdAt хүрээ (default: сүүлийн 30 хоног) */
function range(from?: string, to?: string) {
  const start = from ? new Date(from) : new Date(Date.now() - 29 * DAY_MS);
  if (!from) start.setHours(0, 0, 0, 0);
  const end = to ? new Date(to) : new Date();
  return { start, end };
}

const dayKey = (d: Date) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);

/** ISO 7 хоногийн эхлэл (Даваа)-аар бүлэглэнэ */
function weekKey(d: Date) {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  const day = (local.getUTCDay() + 6) % 7; // Даваа=0
  const monday = new Date(local.getTime() - day * DAY_MS);
  return monday.toISOString().slice(0, 10);
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Борлуулалт: bucket бүрийн захиалгын тоо + дүн (цуцлагдсанг оруулахгүй) */
  async sales(from?: string, to?: string, groupBy: 'day' | 'week' = 'day') {
    const { start, end } = range(from, to);
    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        orderStatus: { not: OrderStatus.CANCELLED },
      },
      select: { createdAt: true, totalAmount: true },
    });

    const keyOf = groupBy === 'week' ? weekKey : dayKey;
    const zero = new Prisma.Decimal(0);
    const buckets = new Map<
      string,
      { bucket: string; count: number; amount: Prisma.Decimal }
    >();
    let totalAmount = zero;
    for (const o of orders) {
      const key = keyOf(o.createdAt);
      const row = buckets.get(key) ?? { bucket: key, count: 0, amount: zero };
      row.count += 1;
      row.amount = row.amount.add(o.totalAmount);
      buckets.set(key, row);
      totalAmount = totalAmount.add(o.totalAmount);
    }

    return {
      groupBy,
      rows: [...buckets.values()].sort((a, b) =>
        a.bucket.localeCompare(b.bucket),
      ),
      totals: { count: orders.length, amount: totalAmount },
    };
  }

  /** Хамгийн их зарагдсан бараанууд — OrderItem-ээс */
  async topProducts(from?: string, to?: string, limit = 10) {
    const { start, end } = range(from, to);
    const groups = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          createdAt: { gte: start, lte: end },
          orderStatus: { not: OrderStatus.CANCELLED },
        },
      },
      _sum: { qty: true, lineTotal: true },
      orderBy: { _sum: { lineTotal: 'desc' } },
      take: limit,
    });

    const products = await this.prisma.product.findMany({
      where: { id: { in: groups.map((g) => g.productId) } },
      select: { id: true, name: true, sku: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    return groups.map((g) => ({
      productId: g.productId,
      name: byId.get(g.productId)?.name ?? 'Устгагдсан бараа',
      sku: byId.get(g.productId)?.sku ?? '—',
      qty: g._sum.qty ?? 0,
      amount: g._sum.lineTotal ?? 0,
    }));
  }

  /** Жолооч бүрийн гүйцэтгэл + бодогдох цалин */
  async drivers(from?: string, to?: string) {
    const { start, end } = range(from, to);
    const [users, assignedGroups, deliveredGroups] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: Role.DRIVER },
        select: {
          id: true,
          fullName: true,
          isActive: true,
          driverProfile: { select: { feePerDelivery: true } },
        },
      }),
      this.prisma.order.groupBy({
        by: ['assignedDriverId'],
        where: {
          assignedDriverId: { not: null },
          assignedAt: { gte: start, lte: end },
        },
        _count: { _all: true },
      }),
      this.prisma.order.groupBy({
        by: ['assignedDriverId'],
        where: {
          assignedDriverId: { not: null },
          deliveryStatus: DeliveryStatus.DELIVERED,
          deliveredAt: { gte: start, lte: end },
        },
        _count: { _all: true },
      }),
    ]);

    const assignedBy = new Map(
      assignedGroups.map((g) => [g.assignedDriverId, g._count._all]),
    );
    const deliveredBy = new Map(
      deliveredGroups.map((g) => [g.assignedDriverId, g._count._all]),
    );

    return users.map((u) => {
      const assigned = assignedBy.get(u.id) ?? 0;
      const delivered = deliveredBy.get(u.id) ?? 0;
      const fee = u.driverProfile?.feePerDelivery ?? new Prisma.Decimal(0);
      return {
        id: u.id,
        name: u.fullName,
        isActive: u.isActive,
        assigned,
        delivered,
        dr: assigned > 0 ? Math.round((delivered / assigned) * 100) / 100 : 0,
        earnings: fee.mul(delivered),
      };
    });
  }

  /** Шинэ vs давтан харилцагч (customerId эсвэл утсаар) + TOP-10 */
  async customers() {
    const groups = await this.prisma.order.groupBy({
      by: ['phone'],
      where: { orderStatus: { not: OrderStatus.CANCELLED } },
      _count: { _all: true },
      _sum: { totalAmount: true },
      orderBy: { _count: { phone: 'desc' } },
    });

    const newCustomers = groups.filter((g) => g._count._all === 1).length;
    const repeatCustomers = groups.filter((g) => g._count._all > 1).length;

    const top = groups.slice(0, 10);
    // Нэрийг нь сүүлийн захиалгаас нь авна
    const names = await Promise.all(
      top.map((g) =>
        this.prisma.order.findFirst({
          where: { phone: g.phone },
          orderBy: { createdAt: 'desc' },
          select: { customerName: true, customerId: true },
        }),
      ),
    );

    return {
      newCustomers,
      repeatCustomers,
      topCustomers: top.map((g, i) => ({
        phone: g.phone,
        name: names[i]?.customerName ?? '—',
        isPortal: !!names[i]?.customerId, // онлайн бүртгэлтэй эсэх
        orders: g._count._all,
        totalAmount: g._sum.totalAmount ?? 0,
      })),
    };
  }
}
