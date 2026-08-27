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
import { PrismaService } from '../prisma/prisma.service';

const METHOD_MN: Record<PaymentMethod, string> = {
  CASH: 'Бэлэн',
  TRANSFER: 'Шилжүүлэг',
  CARD: 'Карт',
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
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('Захиалга олдсонгүй');
    }
    if (order.orderStatus === OrderStatus.CANCELLED) {
      throw new BadRequestException(
        'Цуцлагдсан захиалгад төлбөр бүртгэх боломжгүй',
      );
    }

    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lte(0)) {
      throw new BadRequestException('Дүн 0-ээс их байна');
    }
    const remaining = order.totalAmount.sub(order.paidAmount);
    if (amount.gt(remaining)) {
      throw new BadRequestException(
        `Үлдэгдлээс их дүн (үлдэгдэл: ${remaining.toString()}₮)`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
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
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { order: true },
    });
    if (!payment) {
      throw new NotFoundException('Төлбөр олдсонгүй');
    }

    return this.prisma.$transaction(async (tx) => {
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

  /** Авлага: хүргэгдсэн/дууссан гэхдээ бүрэн төлөгдөөгүй захиалгууд */
  async receivables() {
    const orders = await this.prisma.order.findMany({
      where: {
        paymentStatus: { not: PaymentStatus.PAID },
        orderStatus: { not: OrderStatus.CANCELLED },
        OR: [
          { deliveryStatus: 'DELIVERED' },
          { orderStatus: OrderStatus.COMPLETED },
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
