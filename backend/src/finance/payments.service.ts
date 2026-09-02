import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import {
  FinanceType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '../generated/prisma/client';
import { lockOrderForUpdate } from '../prisma/lock.util';
import { OrgContext } from '../org/org-context';
import { PrismaService } from '../prisma/prisma.service';

/** Хэлбэр нь зөвхөн шилжүүлэг — бэлэн мөнгө системд байхгүй (V5) */
const METHOD_MN: Record<PaymentMethod, string> = {
  TRANSFER: 'Шилжүүлэг',
};

/** paidAmount-аас төлбөрийн статус тооцно */
function statusFor(paid: Prisma.Decimal, total: Prisma.Decimal): PaymentStatus {
  if (paid.gte(total)) return PaymentStatus.PAID;
  if (paid.gt(0)) return PaymentStatus.PARTIAL;
  return PaymentStatus.UNPAID;
}

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Төлбөр бүртгэх. ⭐ ОРЛОГО = ТӨЛБӨР: INCOME entry энд (category
   * "PAYMENT") үүснэ — DELIVERED дээр биш. Бүгд нэг transaction.
   */
  async addPayment(
    orderId: string,
    dto: { amount: string; method: PaymentMethod; note?: string },
    user: AuthUser,
  ) {
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lte(0)) {
      throw new BadRequestException('Дүн 0-ээс их байна');
    }

    return this.prisma.$transaction(async (tx) => {
      // ⭐ Захиалгыг ТРАНЗАКЦ ДОТОР, түгжсэний ДАРАА уншина. Ингэснээр
      // зэрэг орсон хоёр төлбөр дараалалд орж, хоёр дахь нь эхнийхийн
      // ДАРААХ paidAmount-ыг харна (өмнө нь хоёулаа хуучин утгыг уншиж,
      // хоёр дахь бичилт эхнийхийг дарж мөнгө алдагддаг байсан).
      if (!(await lockOrderForUpdate(tx, orderId))) {
        throw new NotFoundException('Захиалга олдсонгүй');
      }
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
      });
      if (order.orderStatus === OrderStatus.CANCELLED) {
        throw new BadRequestException(
          'Цуцлагдсан захиалгад төлбөр бүртгэх боломжгүй',
        );
      }
      const remaining = order.totalAmount.sub(order.paidAmount);
      if (amount.gt(remaining)) {
        throw new BadRequestException(
          `Үлдэгдлээс их дүн (үлдэгдэл: ${remaining.toString()}₮)`,
        );
      }

      const payment = await tx.payment.create({
        data: {
          organizationId: OrgContext.require(),
          orderId,
          amount,
          method: dto.method,
          note: dto.note?.trim() || null,
          receivedById: user.id,
        },
        include: { receivedBy: { select: { id: true, fullName: true } } },
      });

      const newPaid = order.paidAmount.add(amount);
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          paidAmount: newPaid,
          paymentStatus: statusFor(newPaid, order.totalAmount),
        },
        select: { paymentStatus: true, paidAmount: true, totalAmount: true },
      });

      await tx.financeEntry.create({
        data: {
          organizationId: OrgContext.require(),
          type: FinanceType.INCOME,
          category: 'PAYMENT',
          amount,
          note: `Төлбөр ${order.orderNo} (${METHOD_MN[dto.method]})`,
          refOrderId: orderId,
          refPaymentId: payment.id,
          createdById: user.id,
        },
      });

      return { ...payment, order: updated };
    });
  }

  /** Алдаатай бүртгэлийг арилгана — paidAmount + INCOME entry хамт буцна */
  async deletePayment(id: string) {
    // Аль захиалгынх болохыг мэдэхийн тулд эхлээд уншина (түгжээ нь
    // орderId дээр тавигдана); дараа нь бүх зүйл транзакц дотор дахин уншигдана
    const found = await this.prisma.payment.findUnique({
      where: { id },
      select: { orderId: true },
    });
    if (!found) {
      throw new NotFoundException('Төлбөр олдсонгүй');
    }

    return this.prisma.$transaction(async (tx) => {
      // addPayment-тэй ижил түгжээ — зэрэг устгал/нэмэлт дарж бичихгүй
      if (!(await lockOrderForUpdate(tx, found.orderId))) {
        throw new NotFoundException('Захиалга олдсонгүй');
      }
      const payment = await tx.payment.findUnique({
        where: { id },
        include: { order: true },
      });
      if (!payment) {
        throw new NotFoundException('Төлбөр олдсонгүй');
      }
      await tx.payment.delete({ where: { id } });
      await tx.financeEntry.deleteMany({ where: { refPaymentId: id } });
      const newPaid = payment.order.paidAmount.sub(payment.amount);
      const updated = await tx.order.update({
        where: { id: payment.orderId },
        data: {
          paidAmount: newPaid,
          paymentStatus: statusFor(newPaid, payment.order.totalAmount),
        },
        select: { id: true, paymentStatus: true, paidAmount: true },
      });
      return { ok: true, order: updated };
    });
  }

  /**
   * Авлага: хүргэгдсэн/дууссан гэхдээ бүрэн төлөгдөөгүй захиалгууд.
   *
   * БҮТЭН буцаалттай (`returnState = 'FULL'`) захиалга хасагдана: буцаалт
   * `totalAmount`-ыг хөнддөггүй тул бүтэн буцаалт + мөнгө буцаалт хийхэд
   * `paidAmount → 0`, `paymentStatus → UNPAID` болж, бараа нь бүрэн буцаж
   * ирсэн атлаа «төлөгдөөгүй өр» мэт харагддаг байсан. (Мөнгө буцаагаагүй
   * тохиолдолд ч авах өр байхгүй — бараа буцсан.)
   */
  async receivables() {
    const orders = await this.prisma.order.findMany({
      where: {
        paymentStatus: { not: PaymentStatus.PAID },
        orderStatus: { not: OrderStatus.CANCELLED },
        // returnState нь nullable String — NULL мөрүүд хасагдахгүй байх
        // ёстой тул ил бичив
        OR: [{ returnState: null }, { returnState: { not: 'FULL' } }],
        AND: [
          {
            OR: [
              { deliveryStatus: 'DELIVERED' },
              { orderStatus: OrderStatus.COMPLETED },
            ],
          },
        ],
      },
      select: {
        id: true,
        orderNo: true,
        customerName: true,
        phone: true,
        totalAmount: true,
        paidAmount: true,
        paymentStatus: true,
        deliveredAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const now = Date.now();
    let totalRemaining = new Prisma.Decimal(0);
    const items = orders.map((o) => {
      const remaining = o.totalAmount.sub(o.paidAmount);
      totalRemaining = totalRemaining.add(remaining);
      const since = (o.deliveredAt ?? o.createdAt).getTime();
      return {
        ...o,
        remaining,
        daysOutstanding: Math.floor((now - since) / 86_400_000),
      };
    });

    return { items, count: items.length, totalRemaining };
  }
}
