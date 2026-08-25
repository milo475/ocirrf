import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { QueryMovementsDto } from './dto/query-movements.dto';

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Үлдэгдлийг гараар тохируулна. Transaction дотор атомоор:
   * increment ашигласнаар зэрэг хийгдэх adjust-ууд бие биенийхээ
   * утгыг дарж бичихгүй; сөрөг гарвал transaction бүхэлдээ буцна.
   */
  adjust(dto: AdjustStockDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const exists = await tx.product.findUnique({
        where: { id: dto.productId },
        select: { id: true },
      });
      if (!exists) {
        throw new NotFoundException('Бараа олдсонгүй');
      }

      const product = await tx.product.update({
        where: { id: dto.productId },
        data: { stockQty: { increment: dto.qtyChange } },
      });

      if (product.stockQty < 0) {
        // throw хийснээр increment мөн буцаагдана
        throw new BadRequestException(
          'Үлдэгдэл хасах хэмжээнээс бага байна',
        );
      }

      const movement = await tx.stockMovement.create({
        data: {
          productId: dto.productId,
          qtyChange: dto.qtyChange,
          reason: dto.reason,
          refId: null,
          userId,
        },
      });

      return { product, movement };
    });
  }

  async movements(query: QueryMovementsDto) {
    const { productId, page = 1, limit = 20 } = query;
    const where = productId ? { productId } : {};

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
}
