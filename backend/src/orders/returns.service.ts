import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import {
  DeliveryStatus,
  FinanceType,
  OrderStatus,
  PaymentStatus,
  Prisma,
} from '../generated/prisma/client';
import { lockOrderForUpdate } from '../prisma/lock.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { applyBatchDelta } from '../stock/batch.util';

/** paidAmount-аас төлбөрийн статус тооцно (payments.service-тэй ижил дүрэм) */
function statusFor(paid: Prisma.Decimal, total: Prisma.Decimal): PaymentStatus {
  if (paid.gte(total)) return PaymentStatus.PAID;
  if (paid.gt(0)) return PaymentStatus.PARTIAL;
  return PaymentStatus.UNPAID;
}

@Injectable()
export class ReturnsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Буцаалт бүртгэх — зөвхөн COMPLETED/DELIVERED захиалгад.
   * Нэг transaction дотор: OrderReturn + мөрүүд, (restock) үлдэгдэл + RETURN
   * хөдөлгөөн, (refundPayment) paidAmount буцаах + EXPENSE "REFUND",
   * returnState PARTIAL/FULL.
   */
  async create(orderId: string, dto: CreateReturnDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      // ⭐ Бүх уншилт+шалгалт ТРАНЗАКЦ ДОТОР, захиалгын мөрийг түгжсэний
      // ДАРАА явна. Өмнө нь захиалга гаднаас уншигдаж, `paidAmount`-ыг
      // тэр хуучин утгаас тооцдог байсан тул зэрэг орсон буцаалт/төлбөр
      // бие биенээ дарж бичих (мөнгө алдагдах) эрсдэлтэй байв. Мөн
      // "аль хэдийн буцаагдсан тоо ширхэг"-ийн шалгалт ч зэрэг ирсэн хоёр
      // буцаалтад хоёуланд нь давагдах боломжтой байсан.
      if (!(await lockOrderForUpdate(tx, orderId))) {
        throw new NotFoundException('Захиалга олдсонгүй');
      }
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true, returns: { include: { items: true } } },
      });
      if (!order) {
        throw new NotFoundException('Захиалга олдсонгүй');
      }

      const finished =
        order.orderStatus === OrderStatus.COMPLETED ||
        order.deliveryStatus === DeliveryStatus.DELIVERED;
      if (!finished || order.orderStatus === OrderStatus.CANCELLED) {
        throw new BadRequestException(
          'Зөвхөн хүргэгдсэн/дууссан захиалгад буцаалт бүртгэнэ',
        );
      }

      if (dto.excludeFromPayroll && order.payoutId) {
        throw new BadRequestException(
          'Жолоочийн тооцоо аль хэдийн хаагдсан тул цалингаас хасах боломжгүй',
        );
      }

      // Өмнөх буцаалтуудын нийлбэр (мөр тус бүрээр)
      const returnedSoFar = new Map<string, number>();
      for (const r of order.returns) {
        for (const ri of r.items) {
          returnedSoFar.set(
            ri.orderItemId,
            (returnedSoFar.get(ri.orderItemId) ?? 0) + ri.qty,
          );
        }
      }

      // Мөр бүрийн шалгалт + буцаах дүн (priceAtOrder × qty = lineTotal-ийн хувь)
      const itemById = new Map(order.items.map((i) => [i.id, i]));
      const seen = new Set<string>();
      let refundAmount = new Prisma.Decimal(0);
      const lines: { item: (typeof order.items)[number]; qty: number }[] = [];

      for (const row of dto.items) {
        if (seen.has(row.orderItemId)) {
          throw new BadRequestException(
            'Нэг мөрийг давхардуулж илгээсэн байна',
          );
        }
        seen.add(row.orderItemId);

        const item = itemById.get(row.orderItemId);
        if (!item) {
          throw new BadRequestException('Мөр энэ захиалгад хамаарахгүй');
        }
        const already = returnedSoFar.get(item.id) ?? 0;
        if (already + row.qty > item.qty) {
          throw new BadRequestException(
            `"${item.productName}" — буцаах тоо үлдсэнээс их (үлдсэн: ${item.qty - already}ш)`,
          );
        }
        refundAmount = refundAmount.add(item.priceAtOrder.mul(row.qty));
        lines.push({ item, qty: row.qty });
      }

      // Бүх мөр бүрэн буцаагдсан бол FULL
      const willBeFull = order.items.every((i) => {
        const already = returnedSoFar.get(i.id) ?? 0;
        const now = lines.find((l) => l.item.id === i.id)?.qty ?? 0;
        return already + now >= i.qty;
      });

      const restock = dto.restock ?? true;
      // Буцаан олгох дүн төлснөөс хэтрэхгүй
      const refundable = Prisma.Decimal.min(refundAmount, order.paidAmount);
      const doRefund = (dto.refundPayment ?? false) && refundable.gt(0);

      const ret = await tx.orderReturn.create({
        data: {
          orderId,
          reason: dto.reason.trim(),
          refundAmount,
          restocked: restock,
          excludeFromPayroll: dto.excludeFromPayroll ?? false,
          createdById: user.id,
          items: {
            create: lines.map((l) => ({
              orderItemId: l.item.id,
              qty: l.qty,
            })),
          },
        },
        include: {
          items: true,
          createdBy: { select: { id: true, fullName: true } },
        },
      });

      if (restock) {
        for (const l of lines) {
          await tx.product.update({
            where: { id: l.item.productId },
            data: { stockQty: { increment: l.qty } },
          });
          await tx.stockMovement.create({
            data: {
              productId: l.item.productId,
              qtyChange: l.qty,
              reason: 'RETURN',
              note: `Буцаалт ${order.orderNo}`,
              refId: orderId,
              userId: user.id,
            },
          });
          await applyBatchDelta(tx, l.item.productId, l.qty);
        }
      }

      const data: Prisma.OrderUpdateInput = {
        returnState: willBeFull ? 'FULL' : 'PARTIAL',
      };
      if (doRefund) {
        const newPaid = order.paidAmount.sub(refundable);
        data.paidAmount = newPaid;
        data.paymentStatus = statusFor(newPaid, order.totalAmount);
        await tx.financeEntry.create({
          data: {
            type: FinanceType.EXPENSE,
            category: 'REFUND',
            amount: refundable,
            note: `Буцаалт ${order.orderNo}`,
            refOrderId: orderId,
            createdById: user.id,
          },
        });
      }
      const updated = await tx.order.update({
        where: { id: orderId },
        data,
        select: {
          id: true,
          returnState: true,
          paymentStatus: true,
          paidAmount: true,
        },
      });

      return { ...ret, order: updated };
    });
  }
}
