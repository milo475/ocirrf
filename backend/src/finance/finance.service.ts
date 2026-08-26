import { ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { FinanceType, Prisma } from '../generated/prisma/client';
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

  /**
   * Захиалга DELIVERED/COMPLETED болох мөчид АВТОМАТ орлого бүртгэнэ.
   * Статус солих transaction-ы ДОТОР дуудагдана; refOrderId+category
   * шалгалтаар давхардахгүй. DELIVERED эцсийн төлөв тул сөрөг залруулга
   * бичихгүй (цуцлагдах боломжгүй).
   */
  async recordOrderIncome(
    tx: Prisma.TransactionClient,
    order: { id: string; orderNo: string; totalAmount: Prisma.Decimal },
    actorId: string,
  ) {
    const exists = await tx.financeEntry.findFirst({
      where: { refOrderId: order.id, category: 'ORDER' },
      select: { id: true },
    });
    if (exists) return;
    await tx.financeEntry.create({
      data: {
        type: FinanceType.INCOME,
        category: 'ORDER',
        amount: order.totalAmount,
        note: `Захиалга ${order.orderNo}`,
        refOrderId: order.id,
        createdById: actorId,
      },
    });
  }
}
