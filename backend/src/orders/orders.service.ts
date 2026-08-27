import {
  BadRequestException,
  ForbiddenException,
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
import { NotificationsService } from '../notifications/notifications.service';
import { PERM } from '../permissions/permission-keys';
import { PermissionsService } from '../permissions/permissions.service';
import { PrismaService } from '../prisma/prisma.service';
import { formatFullAddress, formatShortAddress } from './address.util';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';

/**
 * Зөвшөөрөгдсөн статус шилжилтүүд.
 * NEW → CONFIRMED → PREPARING (бэлтгэж буй) → READY (гарахад бэлэн) → COMPLETED.
 * COMPLETED болон CANCELLED — эцсийн, цааш шилжихгүй.
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  PREPARING: [OrderStatus.READY, OrderStatus.CANCELLED],
  READY: [OrderStatus.COMPLETED],
  COMPLETED: [],
  CANCELLED: [],
};

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    (e as { code?: string }).code === 'P2002'
  );
}

/** createdBy-г буцаахдаа passwordHash задруулахгүй */
const CREATED_BY_SELECT = {
  select: { id: true, username: true, fullName: true, role: true },
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly permissions: PermissionsService,
  ) {}

  /**
   * Захиалга үүсгэх — бүх өөрчлөлт нэг transaction дотор.
   *
   * orderNo-гийн арга: тухайн өдрийн хамгийн их дугаарыг tx дотор уншиж +1.
   * Дотоод цөөн хэрэглэгчтэй систем тул мөргөлдөөн ховор; давхардвал
   * orderNo-гийн unique constraint P2002 өгч бүх transaction буцна —
   * түүнийг 3 хүртэл удаа retry хийнэ. Тусдаа counter хүснэгт шаардахгүй,
   * зөв байдлыг нь DB-ийн constraint өөрөө баталгаажуулдаг тул энэ аргыг сонгосон.
   */
  async create(dto: CreateOrderDto, user: AuthUser) {
    // CUSTOMER тусгай зам: permission биш role-оор зөвшөөрөгдөнө,
    // бусад нь orders.create permission шаардана
    const isCustomer = user.role === 'CUSTOMER';
    if (!isCustomer) {
      const allowed = await this.permissions.has(
        user.id,
        user.role,
        PERM.ORDERS_CREATE,
      );
      if (!allowed) {
        throw new ForbiddenException('Хандах эрх байхгүй');
      }
    }

    // Утас: customer орхивол профайлын утас default
    let phone = dto.customerPhone ?? null;
    let customerName = dto.customerName ?? null;
    if (isCustomer && (!phone || !customerName)) {
      const profile = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { phone: true, fullName: true },
      });
      phone = phone ?? profile?.phone ?? null;
      customerName = customerName ?? profile?.fullName ?? null;
    }
    if (!phone) {
      throw new BadRequestException('Утасны дугаар заавал');
    }

    const ids = dto.items.map((i) => i.productId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Нэг бараа давхардаж орсон байна');
    }

    // Хүргэлтийн хөлс: хэрэглэгчийн хүсэлтээр шинэ захиалгад автоматаар
    // НЭМЭГДЭХГҮЙ (default 0). Staff dto.deliveryFee-ээр гараар өгч болно;
    // тарифын хүснэгт (V4-05) лавлагаа болж үлдсэн.
    const deliveryFee =
      !isCustomer && dto.deliveryFee !== undefined
        ? new Prisma.Decimal(dto.deliveryFee)
        : new Prisma.Decimal(0);

    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; ; attempt++) {
      try {
        const { order, lowStockCrossed } = await this.createInTransaction(
          dto,
          user.id,
          ids,
          phone,
          customerName,
          isCustomer ? user.id : null,
          deliveryFee,
          // "Төлсөн" флаг зөвхөн staff-д — customer өөрөө тэмдэглэхгүй
          !isCustomer && dto.paid === true,
        );
        // Transaction амжилттай болсны ДАРАА мэдэгдэнэ (rollback-д илгээхгүй)
        for (const p of lowStockCrossed) {
          await this.notifications.notifyLowStock(p);
        }
        if (isCustomer) {
          await this.notifications.notifyCustomerOrder(order);
        }
        return order;
      } catch (e) {
        if (isUniqueViolation(e) && attempt < MAX_ATTEMPTS) {
          continue; // orderNo мөргөлдсөн — дахин оролдоно
        }
        throw e;
      }
    }
  }

  private async createInTransaction(
    dto: CreateOrderDto,
    userId: string,
    ids: string[],
    phone: string,
    customerName: string | null,
    customerId: string | null,
    deliveryFee: Prisma.Decimal,
    markPaid: boolean,
  ) {
    const lowStockCrossed: {
      id: string;
      name: string;
      stockQty: number;
      lowStockLimit: number;
    }[] = [];
    const order = await this.prisma.$transaction(async (tx) => {
      // 1. Бүх барааг нэг мөсөн авч шалгана
      const products = await tx.product.findMany({
        where: { id: { in: ids } },
      });
      const byId = new Map(products.map((p) => [p.id, p]));

      for (const item of dto.items) {
        const product = byId.get(item.productId);
        if (!product) {
          throw new BadRequestException(
            `Бараа олдсонгүй (id: ${item.productId})`,
          );
        }
        if (!product.isActive) {
          throw new BadRequestException(`«${product.name}» идэвхгүй байна`);
        }
        if (item.qty > product.stockQty) {
          throw new BadRequestException(
            `«${product.name}» үлдэгдэл хүрэлцэхгүй (байгаа: ${product.stockQty}, хүссэн: ${item.qty})`,
          );
        }
      }

      // 2. orderNo: ORD-YYYYMMDD-NNNN
      const now = new Date();
      const ymd = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
      ].join('');
      const prefix = `ORD-${ymd}-`;
      const last = await tx.order.findFirst({
        where: { orderNo: { startsWith: prefix } },
        orderBy: { orderNo: 'desc' },
        select: { orderNo: true },
      });
      const nextNum = last
        ? parseInt(last.orderNo.slice(prefix.length), 10) + 1
        : 1;
      const orderNo = prefix + String(nextNum).padStart(4, '0');

      // 3–4. Snapshot + нийт дүн (Decimal — float хэрэглэхгүй).
      // V4-05: нийт дүн = барааны нийлбэр + хүргэлтийн хөлс
      let totalAmount = deliveryFee;
      const itemsData = dto.items.map((item) => {
        const product = byId.get(item.productId)!;
        const lineTotal = product.price.mul(item.qty);
        totalAmount = totalAmount.add(lineTotal);
        return {
          productId: product.id,
          productName: product.name, // snapshot
          qty: item.qty,
          priceAtOrder: product.price, // snapshot
          costAtOrder: product.costPrice, // өртгийн snapshot (v4)
          lineTotal,
        };
      });

      // 5. Order + OrderItem-үүд.
      // Хаяг: зөвхөн өөрийн горимын талбаруудыг хадгалж, эсрэг горимынхыг null
      const isUB = dto.region === 'ULAANBAATAR';
      const order = await tx.order.create({
        data: {
          orderNo,
          customerName,
          phone,
          customerId,
          extraPhone: dto.extraPhone ?? null,
          region: dto.region,
          district: isUB ? dto.district : null,
          khoroo: isUB ? dto.khoroo : null,
          building: isUB ? dto.building : null,
          entrance: isUB ? dto.entrance : null,
          floor: isUB ? dto.floor : null,
          door: isUB ? dto.door : null,
          province: isUB ? null : dto.province,
          soum: isUB ? null : dto.soum,
          transport: isUB ? null : dto.transport,
          addressDetail: isUB ? null : (dto.addressDetail ?? null),
          note: dto.note,
          totalAmount,
          deliveryFee,
          createdById: userId,
          items: { create: itemsData },
        },
        include: { items: true, createdBy: CREATED_BY_SELECT },
      });

      // 6–7. Үлдэгдэл хасах + StockMovement (тус бүр update)
      for (const item of dto.items) {
        const updated = await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { decrement: item.qty } },
        });
        // 1-р шалгалтын дараа өөр transaction үлдэгдэл авчихсан байж
        // болзошгүй — атом decrement сөрөг гарвал бүгдийг буцаана
        if (updated.stockQty < 0) {
          throw new BadRequestException(
            `«${updated.name}» үлдэгдэл хүрэлцэхгүй`,
          );
        }
        // Лимитээс доош ОРОХ МӨЧ: өмнө нь ≥ лимит, одоо < лимит
        if (
          updated.stockQty < updated.lowStockLimit &&
          updated.stockQty + item.qty >= updated.lowStockLimit
        ) {
          lowStockCrossed.push(updated);
        }
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            qtyChange: -item.qty,
            reason: 'ORDER',
            refId: order.id,
            userId,
          },
        });
      }

      // 8. "Төлсөн" гэж бүртгэсэн бол бүтэн төлбөрийг ЭНД шууд бүртгэнэ —
      // ОРЛОГО = ТӨЛБӨР зарчмаар Payment + INCOME entry нэг transaction-д.
      // (customer-ийн илгээсэн paid флагийг create() дээр хаясан байдаг.)
      if (markPaid && totalAmount.gt(0)) {
        const METHOD_MN: Record<string, string> = {
          CASH: 'Бэлэн',
          TRANSFER: 'Шилжүүлэг',
          CARD: 'Карт',
        };
        const method = dto.paymentMethod ?? PaymentMethod.CASH;
        const payment = await tx.payment.create({
          data: {
            orderId: order.id,
            amount: totalAmount,
            method,
            note: 'Захиалга үүсгэхэд төлсөн',
            receivedById: userId,
          },
        });
        await tx.financeEntry.create({
          data: {
            type: FinanceType.INCOME,
            category: 'PAYMENT',
            amount: totalAmount,
            note: `Төлбөр ${orderNo} (${METHOD_MN[method]})`,
            refOrderId: order.id,
            refPaymentId: payment.id,
            createdById: userId,
          },
        });
        const paidOrder = await tx.order.update({
          where: { id: order.id },
          data: { paidAmount: totalAmount, paymentStatus: PaymentStatus.PAID },
          include: { items: true, createdBy: CREATED_BY_SELECT },
        });
        return paidOrder;
      }

      return order;
    });
    return { order, lowStockCrossed };
  }

  async updateStatus(id: string, status: OrderStatus, user: AuthUser) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException('Захиалга олдсонгүй');
    }

    // OPERATOR зөвхөн өөрийн шивсэн захиалгыг удирдана; ADMIN/MANAGER бүгдийг
    if (user.role === 'OPERATOR' && order.createdById !== user.id) {
      throw new ForbiddenException(
        'Зөвхөн өөрийн үүсгэсэн захиалгын статусыг өөрчлөх боломжтой',
      );
    }

    if (!ALLOWED_TRANSITIONS[order.orderStatus].includes(status)) {
      throw new BadRequestException(
        `${order.orderStatus}-ээс ${status} руу шууд шилжих боломжгүй`,
      );
    }

    // Цуцлалт: статус + үлдэгдэл буцаах + movement — нэг transaction
    if (status === OrderStatus.CANCELLED) {
      const cancelled = await this.prisma.$transaction(async (tx) => {
        const cancelled = await tx.order.update({
          where: { id },
          data: {
            orderStatus: OrderStatus.CANCELLED,
            // Жолооч хуваарилагдсан байсан бол хуваарилалтыг цуцална
            assignedDriverId: null,
            assignedAt: null,
          },
          include: { items: true, createdBy: CREATED_BY_SELECT },
        });

        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQty: { increment: item.qty } },
          });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              qtyChange: item.qty,
              reason: 'ORDER_CANCEL',
              refId: order.id,
              userId: user.id,
            },
          });
        }

        return cancelled;
      });
      await this.notifyCustomerStatus(order.customerId, cancelled);
      return cancelled;
    }

    // V4: COMPLETED дээр орлого ҮҮСЭХГҮЙ — орлого = төлбөр
    // (PaymentsService.addPayment). Тиймээс энгийн шилжилтээр явна.

    // Бусад шилжилт — зөвхөн статус update
    const updated = await this.prisma.order.update({
      where: { id },
      data: { orderStatus: status },
      include: { items: true, createdBy: CREATED_BY_SELECT },
    });
    await this.notifyCustomerStatus(order.customerId, updated);
    return updated;
  }

  /** Онлайн захиалагчид статусын өөрчлөлтөө мэдэгдэнэ */
  private async notifyCustomerStatus(
    customerId: string | null,
    order: { id: string; orderNo: string; orderStatus: OrderStatus },
  ) {
    if (!customerId) return;
    await this.notifications.notifyOrderStatus(customerId, order);
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        createdBy: CREATED_BY_SELECT,
        assignedDriver: CREATED_BY_SELECT,
        payments: {
          include: {
            receivedBy: { select: { id: true, fullName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        returns: {
          include: {
            items: true,
            createdBy: { select: { id: true, fullName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!order) {
      throw new NotFoundException('Захиалга олдсонгүй');
    }
    // Бүтэцлэгдсэн талбаруудын хамт нэг мөр хаягийг өгнө
    return { ...order, fullAddress: formatFullAddress(order) };
  }

  async findAll(query: QueryOrdersDto) {
    const {
      status,
      deliveryStatus,
      paymentStatus,
      driverId,
      search,
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.OrderWhereInput = {
      ...(status ? { orderStatus: status } : {}),
      ...(deliveryStatus ? { deliveryStatus } : {}),
      ...(paymentStatus ? { paymentStatus } : {}),
      ...(driverId ? { assignedDriverId: driverId } : {}),
      ...(search
        ? {
            OR: [
              { orderNo: { contains: search, mode: 'insensitive' } },
              { customerName: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          _count: { select: { items: true } },
          createdBy: CREATED_BY_SELECT,
          assignedDriver: CREATED_BY_SELECT,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: items.map((o) => ({ ...o, shortAddress: formatShortAddress(o) })),
      total,
      page,
      limit,
    };
  }
}
