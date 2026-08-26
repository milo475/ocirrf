import { Injectable } from '@nestjs/common';
import { DeliveryStatus, OrderStatus } from '../generated/prisma/client';
import { formatShortAddress } from '../orders/address.util';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import type {
  AdminDashboard,
  ManagerDashboard,
  OperatorDashboard,
} from './dashboard.types';
import type { ProductHealth, StockDriver } from './product-health.type';

/** Локал цагийн бүсээр YYYY-MM-DD түлхүүр */
function dayKey(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

/** Өнөөдрийг оруулаад сүүлийн 7 хоногийн эхлэл (00:00) */
function weekStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 6);
  return d;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const BASE_SCORE = 55;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

type MovementRow = {
  productId: string;
  qtyChange: number;
  reason: string;
  createdAt: Date;
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
  ) {}

  /** ADMIN самбар: харилцагч/жолооч/хүргэлтийн тоонууд + TOP-3 жолооч */
  async admin(): Promise<AdminDashboard> {
    const since = weekStart();

    const [
      phoneGroups,
      totalDrivers,
      deliveriesInProgress,
      deliveredTotal,
      created7,
      delivered7,
      assignedGroups,
      deliveredGroups,
      driverUsers,
    ] = await Promise.all([
      this.prisma.order.groupBy({ by: ['phone'] }),
      this.prisma.user.count({ where: { role: 'DRIVER', isActive: true } }),
      this.prisma.order.count({
        where: {
          deliveryStatus: {
            in: [DeliveryStatus.ASSIGNED, DeliveryStatus.ON_THE_WAY],
          },
        },
      }),
      this.prisma.order.count({
        where: { deliveryStatus: DeliveryStatus.DELIVERED },
      }),
      this.prisma.order.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      this.prisma.order.findMany({
        where: { deliveredAt: { gte: since } },
        select: { deliveredAt: true },
      }),
      this.prisma.order.groupBy({
        by: ['assignedDriverId'],
        where: { assignedDriverId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.order.groupBy({
        by: ['assignedDriverId'],
        where: {
          assignedDriverId: { not: null },
          deliveryStatus: DeliveryStatus.DELIVERED,
        },
        _count: { _all: true },
      }),
      this.prisma.user.findMany({
        where: { role: 'DRIVER' },
        select: { id: true, fullName: true },
      }),
    ]);

    const days = new Map<
      string,
      { date: string; ordersCreated: number; delivered: number }
    >();
    for (let i = 0; i < 7; i++) {
      const key = dayKey(new Date(since.getTime() + i * 86_400_000));
      days.set(key, { date: key, ordersCreated: 0, delivered: 0 });
    }
    for (const o of created7) {
      const row = days.get(dayKey(o.createdAt));
      if (row) row.ordersCreated += 1;
    }
    for (const o of delivered7) {
      if (!o.deliveredAt) continue;
      const row = days.get(dayKey(o.deliveredAt));
      if (row) row.delivered += 1;
    }

    const nameById = new Map(driverUsers.map((u) => [u.id, u.fullName]));
    const deliveredById = new Map(
      deliveredGroups.map((g) => [g.assignedDriverId, g._count._all]),
    );
    const topDrivers = assignedGroups
      .map((g) => {
        const assigned = g._count._all;
        const delivered = deliveredById.get(g.assignedDriverId) ?? 0;
        return {
          id: g.assignedDriverId as string,
          name: nameById.get(g.assignedDriverId as string) ?? '?',
          assigned,
          delivered,
          dr: Math.round((delivered / assigned) * 100) / 100,
        };
      })
      .sort((a, b) => b.dr - a.dr || b.delivered - a.delivered)
      .slice(0, 3);

    return {
      totalCustomers: phoneGroups.length,
      totalDrivers,
      deliveriesInProgress,
      deliveredTotal,
      last7Days: [...days.values()],
      topDrivers,
    };
  }

  /** OPERATOR самбар: өөрийн шивэлт + бага үлдэгдлийн анхааруулга */
  async operator(userId: string): Promise<OperatorDashboard> {
    const since = weekStart();

    const [myOrdersTotal, myDelivered, my7, lowStockProducts] =
      await Promise.all([
        this.prisma.order.count({ where: { createdById: userId } }),
        this.prisma.order.count({
          where: {
            createdById: userId,
            deliveryStatus: DeliveryStatus.DELIVERED,
          },
        }),
        this.prisma.order.findMany({
          where: { createdById: userId, createdAt: { gte: since } },
          select: { createdAt: true },
        }),
        this.prisma.product.findMany({
          where: {
            isActive: true,
            stockQty: { lte: this.prisma.product.fields.lowStockLimit },
          },
          select: {
            id: true,
            name: true,
            sku: true,
            stockQty: true,
            lowStockLimit: true,
          },
          orderBy: { stockQty: 'asc' },
        }),
      ]);

    const days = new Map<string, { date: string; count: number }>();
    for (let i = 0; i < 7; i++) {
      const key = dayKey(new Date(since.getTime() + i * 86_400_000));
      days.set(key, { date: key, count: 0 });
    }
    for (const o of my7) {
      const row = days.get(dayKey(o.createdAt));
      if (row) row.count += 1;
    }

    return {
      myOrdersTotal,
      myDelivered,
      myDr:
        myOrdersTotal > 0
          ? Math.round((myDelivered / myOrdersTotal) * 100) / 100
          : 0,
      last7Days: [...days.values()],
      lowStockProducts,
    };
  }

  /** MANAGER самбар: орлого/зарлага, хуваарилалт хүлээж буй, жолоочийн ачаалал */
  async manager(): Promise<ManagerDashboard> {
    const [stockLast7Days, awaitingAssignment, drivers, loadGroups] =
      await Promise.all([
        this.stockService.summary(7),
        this.prisma.order.findMany({
          where: {
            orderStatus: {
              in: [OrderStatus.CONFIRMED, OrderStatus.PREPARING],
            },
            assignedDriverId: null,
          },
          select: {
            id: true,
            orderNo: true,
            customerName: true,
            phone: true,
            region: true,
            district: true,
            khoroo: true,
            province: true,
            soum: true,
            totalAmount: true,
            orderStatus: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.user.findMany({
          where: { role: 'DRIVER', isActive: true },
          select: {
            id: true,
            fullName: true,
            driverProfile: { select: { isAvailable: true } },
          },
        }),
        this.prisma.order.groupBy({
          by: ['assignedDriverId'],
          where: {
            deliveryStatus: {
              in: [DeliveryStatus.ASSIGNED, DeliveryStatus.ON_THE_WAY],
            },
          },
          _count: { _all: true },
        }),
      ]);

    const loadById = new Map(
      loadGroups.map((g) => [g.assignedDriverId, g._count._all]),
    );

    return {
      stockLast7Days,
      awaitingAssignment: awaitingAssignment.map((o) => ({
        ...o,
        shortAddress: formatShortAddress(o),
      })),
      driverLoad: drivers.map((d) => ({
        id: d.id,
        name: d.fullName,
        isAvailable: d.driverProfile?.isAvailable ?? null,
        active: loadById.get(d.id) ?? 0,
      })),
    };
  }

  /**
   * DASHBOARD.md-ийн ProductHealth[] хэлбэрээр бүх идэвхтэй барааг буцаана.
   * Нийт 3 query: products, 30 хоногийн борлуулалт (groupBy), 90 хоногийн movements.
   * Schema-д байхгүй талбаруудыг гаргах арга:
   *  - reorderLevel: сүүлийн 4 долоо хоногийн дундаж зарлага × 2 (доод тал нь 5)
   *  - lastRestocked: сүүлийн эерэг (цуцлалт биш) movement, байхгүй бол createdAt
   *  - turnoverRate: 30 хоногийн зарлага / (зарлага + одоогийн үлдэгдэл)
   *  - healthHistory: үлдэгдлийг movement-уудаас ухраан сэргээж 13 долоо хоногийн цэг
   */
  async stockHealth(): Promise<ProductHealth[]> {
    const now = new Date();
    const since30 = new Date(now.getTime() - 30 * DAY_MS);
    const since90 = new Date(now.getTime() - 90 * DAY_MS);

    const [products, sales, movements] = await Promise.all([
      this.prisma.product.findMany({
        where: { isActive: true },
        include: { category: { select: { name: true } } },
      }),
      this.prisma.orderItem.groupBy({
        by: ['productId'],
        where: {
          order: {
            createdAt: { gte: since30 },
            orderStatus: { not: OrderStatus.CANCELLED },
          },
        },
        _sum: { lineTotal: true, qty: true },
      }),
      this.prisma.stockMovement.findMany({
        where: { createdAt: { gte: since90 } },
        orderBy: { createdAt: 'asc' },
        select: { productId: true, qtyChange: true, reason: true, createdAt: true },
      }),
    ]);

    const salesById = new Map(sales.map((s) => [s.productId, s]));
    const movesById = new Map<string, MovementRow[]>();
    for (const m of movements) {
      const list = movesById.get(m.productId) ?? [];
      list.push(m);
      movesById.set(m.productId, list);
    }

    return products.map((p) => {
      const s = salesById.get(p.id);
      const moves = movesById.get(p.id) ?? [];
      const monthlySales = s?._sum.lineTotal ? Number(s._sum.lineTotal) : 0;
      const sold30 = s?._sum.qty ?? 0;

      // Долоо хоног тутмын ORDER зарлага (сүүлийн 4 долоо хоног, [0]=хамгийн сүүлийн)
      const weeklyOut = [0, 0, 0, 0];
      for (const m of moves) {
        if (m.reason !== 'ORDER') continue;
        const weeksAgo = Math.floor(
          (now.getTime() - m.createdAt.getTime()) / WEEK_MS,
        );
        if (weeksAgo < 4) weeklyOut[weeksAgo] += -m.qtyChange;
      }
      const weeklyAvgOut = (weeklyOut[0] + weeklyOut[1] + weeklyOut[2] + weeklyOut[3]) / 4;
      const reorderLevel = Math.max(5, Math.ceil(weeklyAvgOut * 2));

      // Сүүлийн нөхөн дүүргэлт: эерэг, цуцлалт биш movement
      const lastRestock = [...moves]
        .reverse()
        .find((m) => m.qtyChange > 0 && m.reason !== 'ORDER_CANCEL');
      const lastRestocked = lastRestock?.createdAt ?? p.createdAt;

      const turnoverRate =
        sold30 + p.stockQty === 0
          ? null
          : Math.round((sold30 / (sold30 + p.stockQty)) * 100) / 100;

      // --- Drivers (DASHBOARD.md-ийн хүснэгт) ---
      const drivers: StockDriver[] = [];

      const adequacy = (qty: number): number => {
        const ratio = qty / reorderLevel;
        if (ratio >= 2) return 25;
        if (ratio >= 1) return 10;
        if (ratio >= 0.5) return -10;
        return -30;
      };
      drivers.push({ label: 'Үлдэгдлийн хүрэлцээ', points: adequacy(p.stockQty) });

      // Зарлагын хурд: сүүлийн 2 долоо хоног vs өмнөх 2 долоо хоног
      const recent = weeklyOut[0] + weeklyOut[1];
      const prev = weeklyOut[2] + weeklyOut[3];
      let trendPoints = 0;
      if (prev > 0 && recent < prev * 0.8) trendPoints = 8; // буурч байгаа
      else if (recent > Math.max(prev, 1) * 1.5) trendPoints = -15; // огцом өссөн
      drivers.push({ label: 'Зарлагын хурд', points: trendPoints });

      const daysSinceRestock = Math.floor(
        (now.getTime() - lastRestocked.getTime()) / DAY_MS,
      );
      drivers.push({
        label: 'Нөхөн дүүргэлтийн хоцролт',
        points: daysSinceRestock < 14 ? 10 : daysSinceRestock <= 30 ? 0 : -12,
      });

      drivers.push({
        label: 'Эргэц',
        points:
          turnoverRate === null
            ? 0
            : turnoverRate > 0.7
              ? 12
              : turnoverRate >= 0.3
                ? 5
                : -8,
      });

      // Инвариант: 55 + sum === stockHealth. Clamp-ийн зөрүүг сүүлийн driver-т шингээнэ.
      const raw = BASE_SCORE + drivers.reduce((a, d) => a + d.points, 0);
      const stockHealth = clamp(raw, 0, 100);
      if (stockHealth !== raw) {
        drivers[drivers.length - 1].points += stockHealth - raw;
      }

      // --- 13 долоо хоногийн түүх: үлдэгдлийг ухраан сэргээнэ ---
      const otherPoints = drivers
        .slice(1)
        .reduce((a, d) => a + d.points, 0);
      const healthHistory: number[] = [];
      for (let w = 12; w >= 1; w--) {
        const t = now.getTime() - w * WEEK_MS;
        // t-ээс ХОЙШ гарсан өөрчлөлтүүдийг буцааж тооцвол тухайн үеийн үлдэгдэл
        const changeAfterT = moves
          .filter((m) => m.createdAt.getTime() > t)
          .reduce((a, m) => a + m.qtyChange, 0);
        const qtyAtT = p.stockQty - changeAfterT;
        healthHistory.push(
          clamp(BASE_SCORE + adequacy(Math.max(0, qtyAtT)) + otherPoints, 0, 100),
        );
      }
      healthHistory.push(stockHealth); // сүүлийнх нь ЯГ одоогийн оноо

      // Дараагийн нөхөлтийн таамаг: өдрийн зарлагаар дуусах хугацаа, эсвэл +30 хоног
      const dailyOut = weeklyAvgOut / 7;
      const nextRestockDate =
        dailyOut > 0
          ? new Date(now.getTime() + Math.ceil(p.stockQty / dailyOut) * DAY_MS)
          : new Date(lastRestocked.getTime() + 30 * DAY_MS);

      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category?.name ?? 'Бусад',
        monthlySales,
        stockQty: p.stockQty,
        reorderLevel,
        stockHealth,
        supplier: '—', // schema-д нийлүүлэгч алга
        lastRestocked: lastRestocked.toISOString(),
        nextRestockDate: nextRestockDate.toISOString(),
        turnoverRate,
        drivers,
        healthHistory,
      };
    });
  }
}
