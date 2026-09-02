import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { Prisma, Role } from '../generated/prisma/client';
import { PERM } from '../permissions/permission-keys';
import { RequirePermission } from '../permissions/require-permission.decorator';
import { PrismaService } from '../prisma/prisma.service';


@Controller('customers')
export class CustomersController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Харилцагчид — өөр компаниас бараа нийлүүлдэг түнш хүмүүс.
   * Системд OPERATOR эрхээр бүртгэгддэг (захиалга шивэх эрхтэй) тул
   * тэднийг захиалгын статистиктай нь жагсаана.
   */
  @Get('partners')
  @RequirePermission(PERM.CUSTOMERS_VIEW)
  async partners() {
    const users = await this.prisma.user.findMany({
      where: { role: Role.OPERATOR },
      select: {
        id: true,
        username: true,
        fullName: true,
        phone: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    const stats = await this.prisma.order.groupBy({
      by: ['createdById'],
      where: { createdById: { in: users.map((u) => u.id) } },
      _count: { _all: true },
      _sum: { totalAmount: true },
      _max: { createdAt: true },
    });
    const byId = new Map(stats.map((s) => [s.createdById, s]));
    return users.map((u) => {
      const s = byId.get(u.id);
      return {
        id: u.id,
        email: u.username,
        name: u.fullName,
        phone: u.phone,
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt,
        orders: s?._count._all ?? 0,
        totalAmount: s?._sum.totalAmount ?? 0,
        lastOrderAt: s?._max.createdAt ?? null,
      };
    });
  }


  /**
   * Нэг хэрэглэгчийн ХУДАЛДАН АВАЛТЫН ТҮҮХ утсаар нь (V5).
   *
   * Борлуулагч хүсэлт батлахаасаа өмнө «энэ хүн өмнө нь юу авч байсан,
   * төлбөрөө төлдөг үү» гэдгийг шалгана. Нярав тооцоо гаргахад, менежер
   * хяналтдаа ашиглана.
   */
  @Get('history')
  @RequirePermission(PERM.CUSTOMERS_VIEW)
  async history(@Query('phone') phone?: string) {
    const value = phone?.trim();
    if (!value) {
      throw new BadRequestException('phone заавал');
    }
    const orders = await this.prisma.order.findMany({
      where: { phone: value },
      include: { items: true, assignedDriver: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Хамгийн их авдаг бараанууд — давтан захиалгыг шууд харуулна
    const byProduct = new Map<string, { name: string; qty: number }>();
    let paidTotal = new Prisma.Decimal(0);
    let liveTotal = new Prisma.Decimal(0);
    let cancelled = 0;
    for (const o of orders) {
      if (o.orderStatus === 'CANCELLED') {
        cancelled++;
        continue;
      }
      liveTotal = liveTotal.plus(o.totalAmount);
      paidTotal = paidTotal.plus(o.paidAmount);
      for (const i of o.items) {
        const cur = byProduct.get(i.productId) ?? { name: i.productName, qty: 0 };
        cur.qty += i.qty;
        byProduct.set(i.productId, cur);
      }
    }

    return {
      phone: value,
      names: [
        ...new Set(orders.map((o) => o.customerName).filter(Boolean)),
      ],
      orders: orders.map((o) => ({
        id: o.id,
        orderNo: o.orderNo,
        createdAt: o.createdAt,
        orderStatus: o.orderStatus,
        deliveryStatus: o.deliveryStatus,
        paymentStatus: o.paymentStatus,
        channel: o.channel,
        totalAmount: o.totalAmount,
        paidAmount: o.paidAmount,
        driverName: o.assignedDriver?.fullName ?? null,
        items: o.items.map((i) => ({ productName: i.productName, qty: i.qty })),
      })),
      summary: {
        orders: orders.length - cancelled,
        cancelled,
        totalAmount: liveTotal,
        paidAmount: paidTotal,
        // Авлага — хяналтын гол тоо
        dueAmount: liveTotal.minus(paidTotal),
        firstOrderAt: orders.at(-1)?.createdAt ?? null,
        lastOrderAt: orders[0]?.createdAt ?? null,
        topProducts: [...byProduct.values()]
          .sort((a, b) => b.qty - a.qty)
          .slice(0, 5),
      },
    };
  }

  /** Утасны захиалгаас бүлэглэсэн харилцагчид */
  @Get('by-phone')
  @RequirePermission(PERM.CUSTOMERS_VIEW)
  async byPhone() {
    const groups = await this.prisma.order.groupBy({
      by: ['phone'],
      _count: { _all: true },
      _sum: { totalAmount: true },
      _max: { createdAt: true },
      orderBy: { _count: { phone: 'desc' } },
      take: 100,
    });
    const names = await this.prisma.order.findMany({
      where: { phone: { in: groups.map((g) => g.phone) } },
      select: { phone: true, customerName: true },
      distinct: ['phone', 'customerName'] as Prisma.OrderScalarFieldEnum[],
    });
    const namesByPhone = new Map<string, string[]>();
    for (const n of names) {
      if (!n.customerName) continue;
      const list = namesByPhone.get(n.phone) ?? [];
      if (!list.includes(n.customerName)) list.push(n.customerName);
      namesByPhone.set(n.phone, list);
    }
    return groups.map((g) => ({
      phone: g.phone,
      names: namesByPhone.get(g.phone) ?? [],
      orders: g._count._all,
      totalAmount: g._sum.totalAmount ?? 0,
      lastOrderAt: g._max.createdAt,
    }));
  }

}
