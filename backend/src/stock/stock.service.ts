import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { OrgContext } from '../org/org-context';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { QueryMovementsDto } from './dto/query-movements.dto';
import { applyBatchDelta } from './batch.util';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Орлого/зарлага/залруулга. Transaction дотор атом increment —
   * шинэ үлдэгдэл сөрөг бол бүхэлдээ буцна.
   * Шалтгааны утга чиглэлтэйгээ таарах ёстой:
   * PURCHASE_IN зөвхөн +, MANUAL_OUT зөвхөн −, CORRECTION аль ч байж болно.
   */
  async adjust(dto: AdjustStockDto, userId: string) {
    if (dto.reason === 'PURCHASE_IN' && dto.qtyChange < 0) {
      throw new BadRequestException('PURCHASE_IN (орлого) эерэг тоотой байна');
    }
    if (dto.reason === 'MANUAL_OUT' && dto.qtyChange > 0) {
      throw new BadRequestException('MANUAL_OUT (зарлага) сөрөг тоотой байна');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const exists = await tx.product.findUnique({
        where: { id: dto.productId },
        select: { id: true },
      });
      if (!exists) {
        throw new NotFoundException('Бараа олдсонгүй');
      }

      const product = await tx.product.update({
        where: { id: dto.productId },
        data: {
          stockQty: { increment: dto.qtyChange },
          // Орлогод нэгжийн өртөг өгсөн бол — "сүүлийн өртөг" зарчмаар
          ...(dto.reason === 'PURCHASE_IN' && dto.unitCost
            ? { costPrice: dto.unitCost }
            : {}),
        },
      });

      if (product.stockQty < 0) {
        // throw хийснээр increment мөн буцаагдана
        throw new BadRequestException(
          'Үлдэгдэл хасах хэмжээнээс бага байна',
        );
      }

      const movement = await tx.stockMovement.create({
        data: {
          organizationId: OrgContext.require(),
          productId: dto.productId,
          qtyChange: dto.qtyChange,
          reason: dto.reason,
          note: dto.note ?? null,
          refId: null,
          userId,
        },
      });

      await applyBatchDelta(tx, dto.productId, dto.qtyChange);

      return { product, movement };
    });

    // Лимитээс доош ОРОХ МӨЧИД мэдэгдэнэ (transaction амжилттайн дараа).
    // Босго нь ЖАГСААЛТЫН шүүлттэй ижил `<=` байна: өмнө нь мэдэгдэл `<`
    // байсан тул яг лимит дээр зогссон бараа "бага үлдэгдэл" жагсаалтад
    // орж ирдэг мөртөө мэдэгдэл нь хэзээ ч ирдэггүй байв.
    const p = result.product;
    if (
      dto.qtyChange < 0 &&
      p.stockQty <= p.lowStockLimit &&
      p.stockQty - dto.qtyChange > p.lowStockLimit
    ) {
      await this.notifications.notifyLowStock(p);
    }
    return result;
  }

  async movements(query: QueryMovementsDto) {
    const { productId, reason, from, to, page = 1, limit = 20 } = query;

    const where: Prisma.StockMovementWhereInput = {
      ...(productId ? { productId } : {}),
      ...(reason ? { reason } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        include: {
          product: { select: { name: true, sku: true } },
          user: { select: { fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Сүүлийн N хоногийн өдөр тутмын орлого(+)/зарлага(−) нийлбэр —
   * manager dashboard-ийн график. Өнөөдрийг оруулаад days хоног.
   */
  async summary(days = 7) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const moves = await this.prisma.stockMovement.findMany({
      where: { createdAt: { gte: start } },
      select: { qtyChange: true, createdAt: true },
    });

    const dayKey = (d: Date) =>
      new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
        .toISOString()
        .slice(0, 10);

    const byDay = new Map<string, { date: string; in: number; out: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(start.getTime() + i * DAY_MS);
      const key = dayKey(d);
      byDay.set(key, { date: key, in: 0, out: 0 });
    }

    for (const m of moves) {
      const row = byDay.get(dayKey(m.createdAt));
      if (!row) continue;
      if (m.qtyChange > 0) row.in += m.qtyChange;
      else row.out += -m.qtyChange;
    }

    return [...byDay.values()];
  }
}
