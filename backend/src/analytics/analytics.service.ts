import { Injectable } from '@nestjs/common';
import {
  DeliveryStatus,
  OrderStatus,
  Prisma,
  Role,
} from '../generated/prisma/client';
import { parseDateRange } from '../date-range.util';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/** from/to → createdAt хүрээ (default: сүүлийн 30 хоног) */
const range = (from?: string, to?: string) => parseDateRange(from, to, 30);

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
      select: {
        createdAt: true,
        totalAmount: true,
        items: { select: { qty: true, costAtOrder: true } },
      },
    });

    const keyOf = groupBy === 'week' ? weekKey : dayKey;
    const zero = new Prisma.Decimal(0);
    const buckets = new Map<
      string,
      {
        bucket: string;
        count: number;
        amount: Prisma.Decimal;
        cost: Prisma.Decimal;
        profit: Prisma.Decimal;
      }
    >();
    let totalAmount = zero;
    let totalCost = zero;
    for (const o of orders) {
      // Захиалгын өртөг = мөр бүрийн snapshot өртөг × тоо (v4)
      const orderCost = o.items.reduce(
        (acc, i) => acc.add(i.costAtOrder.mul(i.qty)),
        zero,
      );
      const key = keyOf(o.createdAt);
      const row =
        buckets.get(key) ?? {
          bucket: key,
          count: 0,
          amount: zero,
          cost: zero,
          profit: zero,
        };
      row.count += 1;
      row.amount = row.amount.add(o.totalAmount);
      row.cost = row.cost.add(orderCost);
      row.profit = row.amount.sub(row.cost);
      buckets.set(key, row);
      totalAmount = totalAmount.add(o.totalAmount);
      totalCost = totalCost.add(orderCost);
    }

    return {
      groupBy,
      rows: [...buckets.values()].sort((a, b) =>
        a.bucket.localeCompare(b.bucket),
      ),
      totals: {
        count: orders.length,
        amount: totalAmount,
        cost: totalCost,
        profit: totalAmount.sub(totalCost),
      },
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

    if (groups.length === 0) return [];
    const ids = groups.map((g) => g.productId);
    const [products, costRows] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, sku: true },
      }),
      // Өртөг×тоо-г aggregate хийж чадахгүй тул raw-аар (v4)
      this.prisma.$queryRaw<
        { productId: string; cost: unknown }[]
      >`SELECT oi."productId", COALESCE(SUM(oi."costAtOrder" * oi.qty), 0) AS cost
        FROM "OrderItem" oi
        JOIN "Order" o ON o.id = oi."orderId"
        WHERE oi."productId" IN (${Prisma.join(ids)})
          AND o."createdAt" >= ${start} AND o."createdAt" <= ${end}
          AND o."orderStatus" != 'CANCELLED'
        GROUP BY oi."productId"`,
    ]);
    const byId = new Map(products.map((p) => [p.id, p]));
    const costBy = new Map<string, Prisma.Decimal>(
      costRows.map((r) => [r.productId, new Prisma.Decimal(String(r.cost))]),
    );

    return groups.map((g) => {
      const amount = g._sum.lineTotal ?? new Prisma.Decimal(0);
      const cost = costBy.get(g.productId) ?? new Prisma.Decimal(0);
      return {
        productId: g.productId,
        name: byId.get(g.productId)?.name ?? 'Устгагдсан бараа',
        sku: byId.get(g.productId)?.sku ?? '—',
        qty: g._sum.qty ?? 0,
        amount,
        cost,
        profit: new Prisma.Decimal(amount).sub(cost),
      };
    });
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

  /**
   * Суваг тус бүрийн захиалга/дүн (V5). Захиалга зөвхөн IG/FB/утаснаас
   * ирдэг болсон тул "аль суваг хэдэн төгрөг авчирсан" нь маркетингийн
   * гол хэмжүүр. Дүнд цуцлагдсан захиалга ОРОХГҮЙ.
   */
  async channels(from?: string, to?: string) {
    const { start, end } = range(from, to);
    const groups = await this.prisma.order.groupBy({
      by: ['channel'],
      where: {
        createdAt: { gte: start, lte: end },
        orderStatus: { not: OrderStatus.CANCELLED },
      },
      _count: { _all: true },
      _sum: { totalAmount: true },
    });
    const total = groups.reduce((a, g) => a + g._count._all, 0);
    return groups
      .map((g) => ({
        channel: g.channel,
        orders: g._count._all,
        amount: g._sum.totalAmount ?? 0,
        share: total > 0 ? Math.round((g._count._all / total) * 100) : 0,
      }))
      .sort((a, b) => b.orders - a.orders);
  }

  /** Шинэ vs давтан хүлээн авагч (утсаар бүлэглэнэ) + TOP-10 */
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
          select: { customerName: true },
        }),
      ),
    );

    return {
      newCustomers,
      repeatCustomers,
      topCustomers: top.map((g, i) => ({
        phone: g.phone,
        name: names[i]?.customerName ?? '—',
        orders: g._count._all,
        totalAmount: g._sum.totalAmount ?? 0,
      })),
    };
  }
}
