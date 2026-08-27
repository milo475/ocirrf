import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import {
  DeliveryStatus,
  FinanceType,
  PayoutStatus,
  Prisma,
  Role,
} from '../generated/prisma/client';
import { PERM, PermKey } from '../permissions/permission-keys';
import { PermissionsService } from '../permissions/permissions.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFinanceEntryDto } from './dto/create-finance-entry.dto';
import { QueryFinanceEntriesDto } from './dto/query-finance.dto';

const DAY_MS = 24 * 60 * 60 * 1000;

const CREATED_BY_SELECT = {
  select: { id: true, fullName: true },
};

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  /** Permission endpoint дээр статик биш — type-аас хамаардаг тул энд шалгана */
  private async requirePerm(user: AuthUser, key: PermKey) {
    if (!(await this.permissions.has(user.id, user.role, key))) {
      throw new ForbiddenException('Хандах эрх байхгүй');
    }
  }

  async createEntry(dto: CreateFinanceEntryDto, user: AuthUser) {
    await this.requirePerm(
      user,
      dto.type === FinanceType.INCOME
        ? PERM.FINANCE_CREATE_INCOME
        : PERM.FINANCE_CREATE_EXPENSE,
    );
    return this.prisma.financeEntry.create({
      data: {
        type: dto.type,
        category: dto.category.trim(),
        amount: new Prisma.Decimal(dto.amount),
        note: dto.note?.trim() || null,
        refOrderId: dto.refOrderId ?? null,
        createdById: user.id,
        ...(dto.entryDate ? { entryDate: new Date(dto.entryDate) } : {}),
      },
      include: { createdBy: CREATED_BY_SELECT },
    });
  }

  async findEntries(query: QueryFinanceEntriesDto, user: AuthUser) {
    const [canIncome, canExpense] = await Promise.all([
      this.permissions.has(user.id, user.role, PERM.FINANCE_VIEW_INCOME),
      this.permissions.has(user.id, user.role, PERM.FINANCE_VIEW_EXPENSE),
    ]);

    // type заасан бол тухайн эрх; заагаагүй бол харж чадах төрлүүд л буцна
    let types: FinanceType[];
    if (query.type) {
      const allowed =
        query.type === FinanceType.INCOME ? canIncome : canExpense;
      if (!allowed) {
        throw new ForbiddenException('Хандах эрх байхгүй');
      }
      types = [query.type];
    } else {
      types = [
        ...(canIncome ? [FinanceType.INCOME] : []),
        ...(canExpense ? [FinanceType.EXPENSE] : []),
      ];
      if (types.length === 0) {
        throw new ForbiddenException('Хандах эрх байхгүй');
      }
    }

    const { page = 1, limit = 20 } = query;
    const where: Prisma.FinanceEntryWhereInput = {
      type: { in: types },
      ...(query.from || query.to
        ? {
            entryDate: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.financeEntry.findMany({
        where,
        include: { createdBy: CREATED_BY_SELECT },
        orderBy: { entryDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.financeEntry.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  /** Өдөр тутмын орлого/зарлага + нийлбэрүүд (хоёр view эрх хоёул хэрэгтэй) */
  async summary(days: number, user: AuthUser) {
    await this.requirePerm(user, PERM.FINANCE_VIEW_INCOME);
    await this.requirePerm(user, PERM.FINANCE_VIEW_EXPENSE);

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const entries = await this.prisma.financeEntry.findMany({
      where: { entryDate: { gte: start } },
      select: { type: true, amount: true, entryDate: true },
    });

    const dayKey = (d: Date) =>
      new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
        .toISOString()
        .slice(0, 10);

    const zero = new Prisma.Decimal(0);
    const byDay = new Map<
      string,
      { date: string; income: Prisma.Decimal; expense: Prisma.Decimal }
    >();
    for (let i = 0; i < days; i++) {
      const key = dayKey(new Date(start.getTime() + i * DAY_MS));
      byDay.set(key, { date: key, income: zero, expense: zero });
    }

    let income = zero;
    let expense = zero;
    for (const e of entries) {
      const row = byDay.get(dayKey(e.entryDate));
      if (e.type === FinanceType.INCOME) {
        income = income.add(e.amount);
        if (row) row.income = row.income.add(e.amount);
      } else {
        expense = expense.add(e.amount);
        if (row) row.expense = row.expense.add(e.amount);
      }
    }

    return {
      days,
      income,
      expense,
      net: income.sub(expense),
      byDay: [...byDay.values()],
    };
  }

  // ── Payroll — жолоочийн цалингийн тооцоо ──

  /** Жолооч бүрээр: тооцоонд ороогүй (payoutId=null) DELIVERED × одоогийн хөлс */
  async payrollPending() {
    const groups = await this.prisma.order.groupBy({
      by: ['assignedDriverId'],
      where: {
        deliveryStatus: DeliveryStatus.DELIVERED,
        payoutId: null,
        assignedDriverId: { not: null },
      },
      _count: { _all: true },
      _min: { deliveredAt: true },
      _max: { deliveredAt: true },
    });
    const drivers = await this.prisma.user.findMany({
      where: { id: { in: groups.map((g) => g.assignedDriverId!) } },
      include: { driverProfile: true },
    });
    const byId = new Map(drivers.map((d) => [d.id, d]));

    return groups.map((g) => {
      const driver = byId.get(g.assignedDriverId!);
      const fee = driver?.driverProfile?.feePerDelivery ?? new Prisma.Decimal(0);
      return {
        driverId: g.assignedDriverId,
        driverName: driver?.fullName ?? '?',
        deliveredCount: g._count._all,
        feePerDelivery: fee,
        amount: fee.mul(g._count._all),
        periodStart: g._min.deliveredAt,
        periodEnd: g._max.deliveredAt,
      };
    });
  }

  /**
   * Тооцоо хаах: жолоочийн тооцоонд ороогүй бүх DELIVERED захиалгыг
   * нэг DriverPayout-д багцалж (fee snapshot), захиалгуудад payoutId
   * тавьж, EXPENSE entry автоматаар бичнэ — бүгд нэг transaction.
   */
  async payrollClose(driverId: string, actor: AuthUser) {
    const driver = await this.prisma.user.findUnique({
      where: { id: driverId },
      include: { driverProfile: true },
    });
    if (!driver || driver.role !== Role.DRIVER) {
      throw new NotFoundException('Жолооч олдсонгүй');
    }
    if (!driver.driverProfile) {
      throw new BadRequestException('Жолоочийн хөлс тохируулаагүй байна');
    }
    const fee = driver.driverProfile.feePerDelivery;

    return this.prisma.$transaction(async (tx) => {
      const orders = await tx.order.findMany({
        where: {
          assignedDriverId: driverId,
          deliveryStatus: DeliveryStatus.DELIVERED,
          payoutId: null,
        },
        select: { id: true, deliveredAt: true },
      });
      if (orders.length === 0) {
        throw new BadRequestException('Тооцоо хийх хүргэлт алга');
      }

      const dates = orders
        .map((o) => o.deliveredAt)
        .filter((d): d is Date => !!d)
        .sort((a, b) => a.getTime() - b.getTime());
      const totalAmount = fee.mul(orders.length);

      const payout = await tx.driverPayout.create({
        data: {
          driverId,
          periodStart: dates[0] ?? new Date(),
          periodEnd: dates[dates.length - 1] ?? new Date(),
          deliveredCount: orders.length,
          feePerDelivery: fee, // snapshot — хөлс дараа өөрчлөгдсөн ч тооцоо хэвээр
          totalAmount,
          createdById: actor.id,
        },
        include: { driver: CREATED_BY_SELECT },
      });

      await tx.order.updateMany({
        where: { id: { in: orders.map((o) => o.id) } },
        data: { payoutId: payout.id },
      });

      // Цалингийн зарлага — refOrderId талбарт payout.id хадгална
      await tx.financeEntry.create({
        data: {
          type: FinanceType.EXPENSE,
          category: 'DRIVER_PAYROLL',
          amount: totalAmount,
          note: `Жолоочийн цалин — ${driver.fullName} (${orders.length} хүргэлт)`,
          refOrderId: payout.id,
          createdById: actor.id,
        },
      });

      return payout;
    });
  }

  /** Тооцоог олгосон болгож тэмдэглэнэ */
  async payrollPay(id: string) {
    const payout = await this.prisma.driverPayout.findUnique({
      where: { id },
    });
    if (!payout) {
      throw new NotFoundException('Тооцоо олдсонгүй');
    }
    if (payout.status === PayoutStatus.PAID) {
      throw new BadRequestException('Энэ тооцоо аль хэдийн олгогдсон');
    }
    return this.prisma.driverPayout.update({
      where: { id },
      data: { status: PayoutStatus.PAID, paidAt: new Date() },
      include: { driver: CREATED_BY_SELECT },
    });
  }

  /** Тооцооны түүх */
  async payrollList(query: { driverId?: string; status?: PayoutStatus }) {
    return this.prisma.driverPayout.findMany({
      where: {
        ...(query.driverId ? { driverId: query.driverId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: { driver: CREATED_BY_SELECT },
      orderBy: { periodEnd: 'desc' },
    });
  }

  // V4: recordOrderIncome устгагдсан — орлого одоо ТӨЛБӨР бүртгэгдэх
  // мөчид PaymentsService.addPayment дотор (category "PAYMENT") үүснэ.
}
