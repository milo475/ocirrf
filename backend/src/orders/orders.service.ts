import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { OrderStatus, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Захиалга үүсгэх — бүх өөрчлөлт нэг transaction дотор.
   *
   * orderNo-гийн арга: тухайн өдрийн хамгийн их дугаарыг tx дотор уншиж +1.
   * Дотоод цөөн хэрэглэгчтэй систем тул мөргөлдөөн ховор; давхардвал
   * orderNo-гийн unique constraint P2002 өгч бүх transaction буцна —
   * түүнийг 3 хүртэл удаа retry хийнэ. Тусдаа counter хүснэгт шаардахгүй,
   * зөв байдлыг нь DB-ийн constraint өөрөө баталгаажуулдаг тул энэ аргыг сонгосон.
   */
  async create(dto: CreateOrderDto, userId: string) {
    const ids = dto.items.map((i) => i.productId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Нэг бараа давхардаж орсон байна');
    }

    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.createInTransaction(dto, userId, ids);
      } catch (e) {
        if (isUniqueViolation(e) && attempt < MAX_ATTEMPTS) {
          continue; // orderNo мөргөлдсөн — дахин оролдоно
        }
        throw e;
      }
    }
  }

  private createInTransaction(
    dto: CreateOrderDto,
    userId: string,
    ids: string[],
  ) {
    return this.prisma.$transaction(async (tx) => {
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

      // 3–4. Snapshot + нийт дүн (Decimal — float хэрэглэхгүй)
      let totalAmount = new Prisma.Decimal(0);
      const itemsData = dto.items.map((item) => {
        const product = byId.get(item.productId)!;
        const lineTotal = product.price.mul(item.qty);
        totalAmount = totalAmount.add(lineTotal);
        return {
          productId: product.id,
          productName: product.name, // snapshot
          qty: item.qty,
          priceAtOrder: product.price, // snapshot
          lineTotal,
        };
      });

      // 5. Order + OrderItem-үүд
      const order = await tx.order.create({
        data: {
          orderNo,
          customerName: dto.customerName,
          phone: dto.customerPhone,
          address: dto.address ?? '',
          note: dto.note,
          totalAmount,
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

      return order;
    });
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
      return this.prisma.$transaction(async (tx) => {
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
    }

    // Бусад шилжилт — зөвхөн статус update
    return this.prisma.order.update({
      where: { id },
      data: { orderStatus: status },
      include: { items: true, createdBy: CREATED_BY_SELECT },
    });
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        createdBy: CREATED_BY_SELECT,
        assignedDriver: CREATED_BY_SELECT,
      },
    });
    if (!order) {
      throw new NotFoundException('Захиалга олдсонгүй');
    }
    return order;
  }

  async findAll(query: QueryOrdersDto) {
    const {
      status,
      deliveryStatus,
      driverId,
      search,
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.OrderWhereInput = {
      ...(status ? { orderStatus: status } : {}),
      ...(deliveryStatus ? { deliveryStatus } : {}),
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

    return { items, total, page, limit };
  }
}
