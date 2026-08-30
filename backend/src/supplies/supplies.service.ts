import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import {
  FinanceType,
  Prisma,
  Role,
} from '../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplyDto } from './dto/create-supply.dto';
import { PaySupplyDto } from './dto/pay-supply.dto';

const SUPPLY_INCLUDE = {
  items: true,
  company: { select: { id: true, name: true, phone: true } },
  supplier: { select: { id: true, fullName: true } },
  receivedBy: { select: { id: true, fullName: true } },
} as const;

@Injectable()
export class SuppliesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Хэн юуг харах вэ — companyId нь ХАНДАЛТЫН биш ШҮҮЛТИЙН нөхцөл.
   *
   * - Дотоод ажилтан (MANAGER/WAREHOUSE/ADMIN): бүх нийлүүлэлт
   * - Харилцагч (OPERATOR): ЗӨВХӨН өөрийн компанийнх. Хоёр харилцагч
   *   бие биеийнхээ өртөг, өрийг харах ёсгүй.
   * - Компанид хараахан ХОЛБОГДООГҮЙ харилцагч: хоосон үр дүн.
   *   Өмнө нь энд 403 шиддэг байсан тул цэс нь харагдаад дарахад
   *   алдаа өгдөг байв — «цэс харагдана гэдэг нь орж болно гэсэн
   *   амлалт». Одоо амлалт зөрчигдөхгүй.
   *
   * `undefined` = хязгааргүй, `null` = хоосон үр дүн.
   */
  private scopeFor(user: AuthUser): string | null | undefined {
    if (user.role !== Role.OPERATOR) return undefined;
    return user.companyId ?? null;
  }

  /**
   * Нийлүүлэлт хүлээж авах (V5).
   *
   * Нэг транзакцид: баримт үүсч, ҮЛДЭГДЭЛ НЭМЭГДЭЖ, хөдөлгөөн
   * бүртгэгдэнэ. Барааны өртөг сүүлийн нийлүүлэлтийн үнээр
   * шинэчлэгдэнэ — ашгийн тооцоо цаашид зөв гарна (хуучин захиалгууд
   * costAtOrder snapshot-оороо хэвээр).
   */
  async create(dto: CreateSupplyDto, user: AuthUser) {
    const ids = dto.items.map((i) => i.productId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Нэг бараа давхардаж орсон байна');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
    });
    if (!company || !company.isActive) {
      throw new BadRequestException('Харилцагч компани олдсонгүй эсвэл идэвхгүй');
    }
    if (dto.supplierId) {
      const supplier = await this.prisma.user.findUnique({
        where: { id: dto.supplierId },
      });
      if (!supplier || supplier.companyId !== dto.companyId) {
        throw new BadRequestException(
          'Харилцагч хүн энэ компанид харьяалагдахгүй байна',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({ where: { id: { in: ids } } });
      const byId = new Map(products.map((p) => [p.id, p]));
      for (const id of ids) {
        if (!byId.has(id)) {
          throw new BadRequestException(`Бараа олдсонгүй (id: ${id})`);
        }
      }

      // Дугаар: НИЙ-YYYYMMDD-NNN
      const now = new Date();
      const ymd = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
      ].join('');
      const prefix = `НИЙ-${ymd}-`;
      const todays = await tx.supply.findMany({
        where: { number: { startsWith: prefix } },
        select: { number: true },
      });
      const next =
        todays.reduce((max, r) => {
          const n = parseInt(r.number.slice(prefix.length), 10);
          return Number.isFinite(n) && n > max ? n : max;
        }, 0) + 1;

      let totalCost = new Prisma.Decimal(0);
      const itemsData = dto.items.map((i) => {
        const product = byId.get(i.productId)!;
        const unitCost = new Prisma.Decimal(i.unitCost);
        const lineTotal = unitCost.mul(i.qty);
        totalCost = totalCost.add(lineTotal);
        return {
          productId: i.productId,
          productName: product.name,
          qty: i.qty,
          unitCost,
          lineTotal,
        };
      });

      const supply = await tx.supply.create({
        data: {
          number: prefix + String(next).padStart(3, '0'),
          companyId: dto.companyId,
          supplierId: dto.supplierId ?? null,
          receivedById: user.id,
          totalCost,
          note: dto.note?.trim() || null,
          items: { create: itemsData },
        },
        include: SUPPLY_INCLUDE,
      });

      for (const i of itemsData) {
        await tx.product.update({
          where: { id: i.productId },
          data: {
            stockQty: { increment: i.qty },
            costPrice: i.unitCost,
            // Барааг аль харилцагчийнх болохыг тэмдэглээгүй бол энд холбоно
            ...(byId.get(i.productId)!.companyId
              ? {}
              : { companyId: dto.companyId }),
          },
        });
        await tx.stockMovement.create({
          data: {
            productId: i.productId,
            qtyChange: i.qty,
            reason: 'SUPPLY',
            note: `${supply.number} · ${company.name}`,
            refId: supply.id,
            userId: user.id,
          },
        });
      }

      return supply;
    });
  }

  async createAndNotify(dto: CreateSupplyDto, user: AuthUser) {
    const supply = await this.create(dto, user);
    await this.notifications.notifySupplyReceived({
      supplyId: supply.id,
      number: supply.number,
      companyName: supply.company.name,
      items: supply.items
        .map((i) => `${i.productName} ×${i.qty}`)
        .join(', '),
      totalCost: `${Number(supply.totalCost).toLocaleString('en-US')}₮`,
      receivedBy: supply.receivedBy.fullName,
    });
    return supply;
  }

  async findAll(user: AuthUser, companyId?: string, unpaidOnly?: boolean) {
    const scope = this.scopeFor(user);
    if (scope === null) return []; // компанид холбогдоогүй харилцагч
    const rows = await this.prisma.supply.findMany({
      where: {
        ...(scope ? { companyId: scope } : companyId ? { companyId } : {}),
      },
      include: SUPPLY_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const list = rows.map((s) => ({
      ...s,
      dueAmount: s.totalCost.minus(s.paidAmount),
    }));
    return unpaidOnly ? list.filter((s) => s.dueAmount.gt(0)) : list;
  }

  async findOne(id: string, user: AuthUser) {
    const scope = this.scopeFor(user);
    const supply = await this.prisma.supply.findUnique({
      where: { id },
      include: SUPPLY_INCLUDE,
    });
    // Компанигүй харилцагчид юу ч нээгдэхгүй; компанитай нь ӨӨРИЙНХӨӨ
    // хүрээнд — бусдын нийлүүлэлтийг шууд id-гаар нээх боломжгүй
    if (
      !supply ||
      scope === null ||
      (scope !== undefined && supply.companyId !== scope)
    ) {
      throw new NotFoundException('Нийлүүлэлт олдсонгүй');
    }
    return { ...supply, dueAmount: supply.totalCost.minus(supply.paidAmount) };
  }

  /**
   * Харилцагч тус бүрийн ТООЦОО: нийт нийлүүлсэн, төлсөн, ӨР.
   * «Хэдийг төлөх ёстой вэ» гэдэг асуултын хариу энд байна.
   */
  async balances(user: AuthUser) {
    const scope = this.scopeFor(user);
    if (scope === null) return []; // компанид холбогдоогүй харилцагч
    const companies = await this.prisma.company.findMany({
      where: { ...(scope ? { id: scope } : {}) },
      select: { id: true, name: true, phone: true, isActive: true },
      orderBy: { name: 'asc' },
    });
    const groups = await this.prisma.supply.groupBy({
      by: ['companyId'],
      _sum: { totalCost: true, paidAmount: true },
      _count: { _all: true },
      _max: { createdAt: true },
    });
    const byId = new Map(groups.map((g) => [g.companyId, g]));
    return companies.map((c) => {
      const g = byId.get(c.id);
      const total = g?._sum.totalCost ?? new Prisma.Decimal(0);
      const paid = g?._sum.paidAmount ?? new Prisma.Decimal(0);
      return {
        companyId: c.id,
        name: c.name,
        phone: c.phone,
        isActive: c.isActive,
        supplies: g?._count._all ?? 0,
        totalCost: total,
        paidAmount: paid,
        dueAmount: total.minus(paid),
        lastSupplyAt: g?._max.createdAt ?? null,
      };
    });
  }

  /**
   * Харилцагчид төлбөр хийх — ЗАРЛАГА болж санхүүд бүртгэгдэнэ.
   * Хэсэгчилсэн төлбөр зөвшөөрөгдөнө (нэг мөсөн эсвэл сар бүр тооцоо
   * хийдэг эсэх нь компанийн журамд үлдээв).
   */
  async pay(id: string, dto: PaySupplyDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const supply = await tx.supply.findUnique({
        where: { id },
        include: { company: { select: { name: true } } },
      });
      if (!supply) {
        throw new NotFoundException('Нийлүүлэлт олдсонгүй');
      }
      const amount = new Prisma.Decimal(dto.amount);
      if (amount.lte(0)) {
        throw new BadRequestException('Дүн 0-ээс их байна');
      }
      const due = supply.totalCost.minus(supply.paidAmount);
      if (amount.gt(due)) {
        throw new BadRequestException(
          `Үлдэгдэл өрөөс их байна (үлдсэн: ${due.toString()})`,
        );
      }

      await tx.financeEntry.create({
        data: {
          type: FinanceType.EXPENSE,
          category: 'SUPPLY',
          amount,
          note: `${supply.number} · ${supply.company.name}`,
          createdById: user.id,
        },
      });

      const updated = await tx.supply.update({
        where: { id },
        data: { paidAmount: supply.paidAmount.plus(amount) },
        include: SUPPLY_INCLUDE,
      });
      return {
        ...updated,
        dueAmount: updated.totalCost.minus(updated.paidAmount),
      };
    });
  }
}
