import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { daysUntil, expiryState, ExpiryState } from '../stock/batch.util';
import { CreateBatchDto, WriteOffDto } from './dto/batch.dto';

const BATCH_INCLUDE = {
  product: { select: { id: true, name: true, sku: true, unit: true } },
  supply: { select: { id: true, number: true } },
  createdBy: { select: { id: true, fullName: true } },
} as const;

@Injectable()
export class BatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /** Тохиргооноос анхааруулах хоног (буруу утганд 30). */
  private async warnDays(): Promise<number> {
    const n = parseInt(await this.settings.get('expiryWarnDays'), 10);
    return Number.isFinite(n) && n > 0 ? n : 30;
  }

  /**
   * Цувралуудыг хугацаагаар нь эрэмбэлж буцаана.
   *
   * `state` шүүлт нь UI-ийн таб (Дууссан / Яаралтай / Анхаарах / Хэвийн)
   * -тай яг тохирно.
   */
  async findAll(params: {
    state?: ExpiryState | 'ALL';
    productId?: string;
    includeEmpty?: boolean;
  }) {
    const warn = await this.warnDays();
    const rows = await this.prisma.productBatch.findMany({
      where: {
        writtenOffAt: null,
        ...(params.productId ? { productId: params.productId } : {}),
        ...(params.includeEmpty ? {} : { remaining: { gt: 0 } }),
      },
      include: BATCH_INCLUDE,
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
    });

    const mapped = rows.map((b) => ({
      ...b,
      daysLeft: daysUntil(b.expiryDate),
      state: expiryState(b.expiryDate, warn),
    }));

    if (!params.state || params.state === 'ALL') return mapped;
    return mapped.filter((b) => b.state === params.state);
  }

  /**
   * Анхааруулгын хураангуй — хяналтын самбар ба мэдэгдэлд.
   *
   * Мөнгөн дүнг ӨРТГӨӨР бодно: хугацаа дуусвал энэ бол бодит алдагдал,
   * борлуулах байсан үнэ биш.
   */
  async summary() {
    const warn = await this.warnDays();
    const rows = await this.prisma.productBatch.findMany({
      where: { writtenOffAt: null, remaining: { gt: 0 } },
      include: { product: { select: { name: true, costPrice: true } } },
      orderBy: { expiryDate: 'asc' },
    });

    const buckets: Record<ExpiryState, { batches: number; qty: number; value: number }> = {
      EXPIRED: { batches: 0, qty: 0, value: 0 },
      CRITICAL: { batches: 0, qty: 0, value: 0 },
      WARNING: { batches: 0, qty: 0, value: 0 },
      OK: { batches: 0, qty: 0, value: 0 },
    };
    for (const b of rows) {
      const s = expiryState(b.expiryDate, warn);
      buckets[s].batches += 1;
      buckets[s].qty += b.remaining;
      buckets[s].value += Number(b.product.costPrice) * b.remaining;
    }

    return {
      warnDays: warn,
      ...buckets,
      /** Хамгийн яаралтай 5 — самбарт шууд харуулна */
      soonest: rows.slice(0, 5).map((b) => ({
        id: b.id,
        productName: b.product.name,
        expiryDate: b.expiryDate,
        remaining: b.remaining,
        daysLeft: daysUntil(b.expiryDate),
        state: expiryState(b.expiryDate, warn),
      })),
    };
  }

  /**
   * Хуучин үлдэгдэлд ГАРААР хугацаа зүүнэ.
   *
   * ЧУХАЛ: үлдэгдлийг НЭМЭХГҮЙ. Бараа аль хэдийн агуулахад байгаа —
   * бид зүгээр л «эдгээрийн хэд нь хэзээ дуусах вэ» гэдгийг тэмдэглэж
   * байна. Тиймээс цувралуудын нийлбэр үлдэгдлээс хэтэрч болохгүй.
   */
  async create(dto: CreateBatchDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: dto.productId } });
      if (!product) throw new NotFoundException('Бараа олдсонгүй');

      const open = await tx.productBatch.aggregate({
        where: { productId: dto.productId, writtenOffAt: null },
        _sum: { remaining: true },
      });
      const tracked = open._sum.remaining ?? 0;
      const untracked = product.stockQty - tracked;
      if (dto.qty > untracked) {
        throw new BadRequestException(
          `Хугацаа зүүгээгүй үлдэгдэл ${untracked} ${product.unit} байна. ` +
            `${dto.qty} гэж оруулах боломжгүй — эхлээд шинэ бараа орлогод авна уу.`,
        );
      }

      return tx.productBatch.create({
        data: {
          productId: dto.productId,
          batchNo: dto.batchNo?.trim() || null,
          expiryDate: new Date(dto.expiryDate + 'T00:00:00.000Z'),
          qty: dto.qty,
          remaining: dto.qty,
          note: dto.note?.trim() || null,
          createdById: user.id,
        },
        include: BATCH_INCLUDE,
      });
    });
  }

  /**
   * УСТГАЛД ГАРГАХ — хугацаа дууссан барааг үлдэгдлээс хасна.
   *
   * Энэ бол бодит зарлага: бараа физикээр устгагдана. Тиймээс
   * Product.stockQty буурч, StockMovement («EXPIRED») бичигдэнэ.
   * Цувралыг шууд хаадаг тул applyBatchDelta-г дуудахгүй — эс тэгвэл
   * тоо хоёр дахин хасагдана.
   */
  async writeOff(id: string, dto: WriteOffDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.productBatch.findUnique({
        where: { id },
        include: { product: { select: { name: true, unit: true } } },
      });
      if (!batch) throw new NotFoundException('Цуврал олдсонгүй');
      if (batch.writtenOffAt) {
        throw new BadRequestException('Энэ цуврал аль хэдийн устгалд гарсан');
      }
      if (batch.remaining <= 0) {
        throw new BadRequestException('Үлдэгдэлгүй цуврал — устгах юм алга');
      }

      await tx.product.update({
        where: { id: batch.productId },
        data: { stockQty: { decrement: batch.remaining } },
      });
      await tx.stockMovement.create({
        data: {
          productId: batch.productId,
          qtyChange: -batch.remaining,
          reason: 'EXPIRED',
          note:
            `Хугацаа дууссан устгал` +
            (batch.batchNo ? ` · цуврал ${batch.batchNo}` : '') +
            (dto.note?.trim() ? ` · ${dto.note.trim()}` : ''),
          refId: batch.id,
          userId: user.id,
        },
      });

      return tx.productBatch.update({
        where: { id },
        data: { remaining: 0, writtenOffAt: new Date() },
        include: BATCH_INCLUDE,
      });
    });
  }
}
