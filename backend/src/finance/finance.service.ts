import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { parseDateRange } from '../date-range.util';
import {
  DeliveryStatus,
  FinanceType,
  OrderStatus,
  PayoutStatus,
  Prisma,
  Role,
} from '../generated/prisma/client';
import { PERM, PermKey } from '../permissions/permission-keys';
import { PermissionsService } from '../permissions/permissions.service';
import { OrgContext } from '../org/org-context';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFinanceEntryDto } from './dto/create-finance-entry.dto';
import { QueryFinanceEntriesDto } from './dto/query-finance.dto';
import {
  categoryLabel,
  countsInPnl,
  manualCategories,
} from './finance-categories';

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
    /**
     * Ангилал нь каталогийн КОД байх ёстой (V5).
     *
     * Өмнө нь чөлөөт текст байсан тул нэг зардал «Түрээс», «түрээс»,
     * «Оффисын түрээс» гэж гурав хуваагдаж, тайлан бүлэглэгдэхгүй
     * байв. Автомат ангиллыг (PAYMENT, SUPPLY…) гараар бичихийг ч
     * хориглоно — тэдгээр нь тайланд тусгай журмаар боловсруулагддаг
     * тул гараар нэмбэл тоо давхардана.
     */
    const code = dto.category.trim();
    const allowed = manualCategories(dto.type);
    if (!allowed.some((c) => c.code === code)) {
      throw new BadRequestException(
        `Ангилал буруу. Боломжит утгууд: ${allowed
          .map((c) => `${c.code} (${c.label})`)
          .join(', ')}`,
      );
    }

    return this.prisma.financeEntry.create({
      data: {
        organizationId: OrgContext.require(),
        type: dto.type,
        category: code,
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
      // ОГНООНЫ МУЖ — `parseDateRange`-ээр (V5 засвар). Өмнө нь
      // `new Date('2026-09-03')` шууд хэрэглэгддэг байсан нь ES-ийн дүрмээр
      // UTC шөнө дунд болж хөрвөж, `to`-гоор өгсөн ӨДӨР БҮХЭЛДЭЭ мужаас
      // хасагддаг байв (UB нь UTC+8 тул `from` өдрийн эхний 8 цаг ч алдагдана).
      // Улмаас ижил мужаар /finance/entries болон /finance/pnl хоёр өөр
      // дүн харуулдаг байсан — сүүлийнх нь parseDateRange хэрэглэдэг.
      ...(query.from || query.to
        ? (() => {
            const { start, end } = parseDateRange(query.from, query.to);
            return {
              entryDate: {
                ...(query.from ? { gte: start } : {}),
                ...(query.to ? { lte: end } : {}),
              },
            };
          })()
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

    // Борлуулалтын ашиг (v4) — төлбөр төвтэй биш БОРЛУУЛАЛТ төвтэй:
    // тухайн хугацаанд ҮҮССЭН (цуцлагдаагүй) захиалгуудын
    // орлого − борлуулсан барааны snapshot өртөг.
    // V5: буцаагдсан тоо ширхэг хасагдана — өмнө нь бүтэн буцаалттай
    // захиалга бараа нь агуулахад ирчихсэн атлаа борлуулалтад
    // тоологдсоор байв.
    const salesRows = await this.prisma.$queryRaw<
      { revenue: Prisma.Decimal; cost: Prisma.Decimal }[]
    >`SELECT COALESCE(SUM(oi."priceAtOrder" * (oi.qty - COALESCE(r.qty, 0))), 0) AS revenue,
             COALESCE(SUM(oi."costAtOrder" * (oi.qty - COALESCE(r.qty, 0))), 0) AS cost
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      -- Буцаагдсан бараа борлуулалт БИШ: агуулахад буцаж ирсэн тул
      -- орлого/өртгөөс нь хасна (мөнгө буцаасан эсэхээс үл хамааран —
      -- буцаалтын мөнгө нь тусад нь REFUND зарлагаар бүртгэгддэг).
      LEFT JOIN (
        SELECT ri."orderItemId", SUM(ri.qty) AS qty
        FROM "OrderReturnItem" ri
        GROUP BY ri."orderItemId"
      ) r ON r."orderItemId" = oi.id
      -- Raw SQL-д org-scope extension үйлчлэхгүй тул ГАРААР шүүнэ (Multi-tenancy)
      WHERE o."organizationId" = ${OrgContext.require()}
        AND o."createdAt" >= ${start} AND o."orderStatus" != 'CANCELLED'`;
    const salesRevenue = salesRows[0]?.revenue ?? zero;
    const salesCost = salesRows[0]?.cost ?? zero;

    return {
      days,
      income,
      expense,
      net: income.sub(expense),
      salesRevenue,
      salesCost,
      salesProfit: new Prisma.Decimal(salesRevenue).sub(salesCost),
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
        // V4: цалингаас хасах буцаалттай захиалга тооцогдохгүй
        returns: { none: { excludeFromPayroll: true } },
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
      const fee =
        driver?.driverProfile?.feePerDelivery ?? new Prisma.Decimal(0);
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
          // V4: цалингаас хасах буцаалттай захиалга тооцогдохгүй
          returns: { none: { excludeFromPayroll: true } },
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
          organizationId: OrgContext.require(),
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

      /**
       * ЗАХИАЛГУУДЫГ АТОМООР ЭЗЭМШИНЭ (V5 засвар).
       *
       * Дээрх сонголт нь `payoutId: null`-аар шүүдэг ч мөрийн түгжээгүй
       * бөгөөд PostgreSQL-ийн READ COMMITTED-д зэрэгцээ транзакц ижил
       * олонлогийг уншиж чадна. «Тооцоо хаах» товчийг хоёр дарахад хоёр
       * DriverPayout болон ХОЁР `DRIVER_PAYROLL` зарлага үүсч, 200,000₮-ийн
       * ажилд 400,000₮ зарлага бичигддэг байв (`payoutId` сүүлийнхээр
       * дарагдах тул `payrollPending` 0 харуулж, хэн ч анзаардаггүй).
       *
       * `payoutId: null` нөхцөлтэй `updateMany` нь зөвхөн нэг талд
       * амжилттай болно; өөрчлөгдсөн тоо зөрвөл бүх транзакц буцна.
       */
      const claimed = await tx.order.updateMany({
        where: { id: { in: orders.map((o) => o.id) }, payoutId: null },
        data: { payoutId: payout.id },
      });
      if (claimed.count !== orders.length) {
        throw new BadRequestException(
          'Тооцоо энэ хооронд хийгдсэн байна. Хуудсыг сэргээгээд дахин шалгана уу.',
        );
      }

      // Цалингийн зарлага — refOrderId талбарт payout.id хадгална
      await tx.financeEntry.create({
        data: {
          organizationId: OrgContext.require(),
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

  /**
   * САНХҮҮГИЙН БАЙРЛАЛ — «одоо юу байна» гэдгийг харуулна.
   *
   * Мөнгөн урсгал нь «хэд орж, хэд гарсныг» хэлдэг ч «хэн бидэнд
   * өртэй, агуулахад хэдийн бараа байгааг» хэлдэггүй. Нягтланд
   * хэрэгтэй нөгөө тал нь энэ.
   *
   * ЖИЧИ: `mongo` нь ЭНЭ СИСТЕМД бүртгэгдсэн гүйлгээний үлдэгдэл —
   * банкны бодит үлдэгдэл БИШ. Систем нэвтрэхээс өмнөх мөнгө,
   * эндээс гадуур хийсэн гүйлгээ үүнд ороогүй.
   */
  async position(user: AuthUser) {
    await this.requirePerm(user, PERM.FINANCE_VIEW_INCOME);
    await this.requirePerm(user, PERM.FINANCE_VIEW_EXPENSE);

    const [flows, orders, supplies, products, noCost] = await Promise.all([
      this.prisma.financeEntry.groupBy({
        by: ['type'],
        _sum: { amount: true },
      }),
      // Авлага — цуцлаагүй захиалгын төлөгдөөгүй үлдэгдэл
      this.prisma.order.findMany({
        where: { orderStatus: { not: OrderStatus.CANCELLED } },
        select: { totalAmount: true, paidAmount: true },
      }),
      // Өглөг — нийлүүлэгчид төлөөгүй үлдэгдэл
      this.prisma.supply.findMany({
        select: { totalCost: true, paidAmount: true },
      }),
      this.prisma.product.findMany({
        select: { stockQty: true, costPrice: true },
      }),
      // Өртөггүй бараа — байвал бараа материал ба ашиг ДУТУУ гарна
      this.prisma.product.count({
        where: { stockQty: { gt: 0 }, costPrice: new Prisma.Decimal(0) },
      }),
    ]);

    const zero = new Prisma.Decimal(0);
    const sumOf = (t: FinanceType) =>
      flows.find((f) => f.type === t)?._sum.amount ?? zero;

    let receivable = zero;
    for (const o of orders) {
      const due = o.totalAmount.minus(o.paidAmount);
      if (due.gt(0)) receivable = receivable.plus(due);
    }

    let payable = zero;
    for (const s of supplies) {
      const due = s.totalCost.minus(s.paidAmount);
      if (due.gt(0)) payable = payable.plus(due);
    }

    let inventory = zero;
    for (const p of products) {
      inventory = inventory.plus(p.costPrice.mul(p.stockQty));
    }

    const cash = sumOf(FinanceType.INCOME).minus(sumOf(FinanceType.EXPENSE));

    return {
      cash: cash.toFixed(2),
      receivable: receivable.toFixed(2),
      payable: payable.toFixed(2),
      inventory: inventory.toFixed(2),
      /** Цэвэр байрлал — өөрийн гэж үзэж болох дүн */
      net: cash.plus(receivable).plus(inventory).minus(payable).toFixed(2),
      /** Өртөг оруулаагүй барааны тоо — тайлан дутуу болохын шинж */
      productsWithoutCost: noCost,
    };
  }

  /**
   * ОРЛОГО ТАЙЛАН (P&L) — нягтланд өгөх үндсэн тайлан.
   *
   * Мөнгөн урсгалаас ЯЛГААТАЙ: борлуулалт нь ЗАХИАЛГААС гарна
   * (төлсөн эсэхээс үл хамааран), зардал нь бүртгэсэн гүйлгээнээс.
   * Бараа худалдан авалт ба буцаалт нь тайланд ОРОХГҮЙ —
   * finance-categories.ts-ийн `inPnl`-ийг үзнэ үү.
   */
  async pnl(from: Date, to: Date, user: AuthUser) {
    await this.requirePerm(user, PERM.FINANCE_VIEW_INCOME);
    await this.requirePerm(user, PERM.FINANCE_VIEW_EXPENSE);

    // Борлуулалт ба ЗБӨ — буцаагдсан тоог хассан цэвэр дүнгээр
    const sales = await this.prisma.$queryRaw<
      Array<{ revenue: Prisma.Decimal; cost: Prisma.Decimal }>
    >`
      SELECT COALESCE(SUM(oi."priceAtOrder" * (oi.qty - COALESCE(r.qty, 0))), 0) AS revenue,
             COALESCE(SUM(oi."costAtOrder"  * (oi.qty - COALESCE(r.qty, 0))), 0) AS cost
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      LEFT JOIN (SELECT ri."orderItemId", SUM(ri.qty) AS qty
                 FROM "OrderReturnItem" ri GROUP BY ri."orderItemId") r
        ON r."orderItemId" = oi.id
      -- Raw SQL-д org-scope extension үйлчлэхгүй тул ГАРААР шүүнэ (Multi-tenancy)
      WHERE o."organizationId" = ${OrgContext.require()}
        AND o."createdAt" >= ${from} AND o."createdAt" <= ${to}
        AND o."orderStatus" != 'CANCELLED'
    `;
    const revenue = new Prisma.Decimal(sales[0]?.revenue ?? 0);
    const cogs = new Prisma.Decimal(sales[0]?.cost ?? 0);

    const entries = await this.prisma.financeEntry.groupBy({
      by: ['type', 'category'],
      where: { entryDate: { gte: from, lte: to } },
      _sum: { amount: true },
    });

    const zero = new Prisma.Decimal(0);
    let expenseTotal = zero;
    let otherIncome = zero;

    /**
     * НЭР-ээр нэгтгэнэ, код-оор биш: 'PAYMENT' ба хуучин 'ORDER' хоёр
     * ижил утгатай тул тайланд «Захиалгын төлбөр» гэж ХОЁР мөр гарч
     * нягтланг төөрөгдүүлдэг байв.
     */
    const merge = (
      map: Map<string, Prisma.Decimal>,
      label: string,
      amount: Prisma.Decimal,
    ) => map.set(label, (map.get(label) ?? zero).plus(amount));

    const expenseMap = new Map<string, Prisma.Decimal>();
    const excludedMap = new Map<string, Prisma.Decimal>();

    for (const e of entries) {
      const amount = e._sum.amount ?? zero;
      const label = categoryLabel(e.type, e.category);
      if (!countsInPnl(e.type, e.category)) {
        merge(excludedMap, label, amount);
        continue;
      }
      if (e.type === FinanceType.EXPENSE) {
        expenseTotal = expenseTotal.plus(amount);
        merge(expenseMap, label, amount);
      } else {
        otherIncome = otherIncome.plus(amount);
      }
    }

    const toRows = (m: Map<string, Prisma.Decimal>) =>
      [...m.entries()]
        .map(([label, amount]) => ({ label, amount: amount.toFixed(2) }))
        .sort((a, b) => Number(b.amount) - Number(a.amount));
    const expenses = toRows(expenseMap);
    const excluded = toRows(excludedMap);

    const grossProfit = revenue.minus(cogs);
    const netProfit = grossProfit.plus(otherIncome).minus(expenseTotal);

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      revenue: revenue.toFixed(2),
      cogs: cogs.toFixed(2),
      grossProfit: grossProfit.toFixed(2),
      otherIncome: otherIncome.toFixed(2),
      expenses,
      expenseTotal: expenseTotal.toFixed(2),
      netProfit: netProfit.toFixed(2),
      excluded,
    };
  }

  // V4: recordOrderIncome устгагдсан — орлого одоо ТӨЛБӨР бүртгэгдэх
  // мөчид PaymentsService.addPayment дотор (category "PAYMENT") үүснэ.
}
