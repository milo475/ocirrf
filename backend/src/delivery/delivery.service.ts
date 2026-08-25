import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DeliveryStatus,
  OrderStatus,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompleteDeliveryDto } from './dto/complete-delivery.dto';

const DAY_MS = 24 * 60 * 60 * 1000;

const DRIVER_SELECT = {
  select: { id: true, username: true, fullName: true },
};

@Injectable()
export class DeliveryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Жолооч хуваарилах.
   *
   * orderStatus-ыг ЭНД өөрчилдөггүй (READY/SHIPPED болгодоггүй) — сонголтын
   * тайлбар: DeliveryStatus enum (PENDING→ASSIGNED→ON_THE_WAY→DELIVERED/FAILED)
   * нь хүргэлтийн явцыг өөрөө бүрэн илэрхийлдэг тусдаа дамжлага. Харин
   * orderStatus нь агуулахын бэлтгэлийн төлөв: жолооч хуваарилагдсан ч бараа
   * бэлтгэгдэж дуусаагүй (PREPARING) байж болно. Хоёр асуудлыг хольж нэг
   * талбарт шахвал "хуваарилагдсан гэхдээ бэлдэж дуусаагүй" төлөв алга болно.
   * Тиймээс: хуваарилалт = deliveryStatus:ASSIGNED, харин орderStatus-ын
   * READY(SHIPPED) руу шилжихийг агуулах өөрөө статусын товчоор хийнэ.
   */
  async assignDriver(orderId: string, driverId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('Захиалга олдсонгүй');
    }

    const driver = await this.prisma.user.findUnique({
      where: { id: driverId },
    });
    if (!driver || driver.role !== 'DRIVER' || !driver.isActive) {
      throw new BadRequestException(
        'Жолооч олдсонгүй эсвэл идэвхгүй байна (role=DRIVER байх ёстой)',
      );
    }

    // Зөвхөн CONFIRMED эсвэл PREPARING(=PACKED) захиалгад хуваарилна
    if (
      order.orderStatus !== OrderStatus.CONFIRMED &&
      order.orderStatus !== OrderStatus.PREPARING
    ) {
      throw new BadRequestException(
        `${order.orderStatus} төлөвтэй захиалгад жолооч хуваарилах боломжгүй (CONFIRMED эсвэл PREPARING байх ёстой)`,
      );
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        assignedDriverId: driverId,
        assignedAt: new Date(),
        deliveryStatus: DeliveryStatus.ASSIGNED,
      },
      include: { assignedDriver: DRIVER_SELECT },
    });
  }

  /** Жолоочийн өөрийн дуусаагүй хүргэлтүүд */
  myDeliveries(driverId: string) {
    return this.prisma.order.findMany({
      where: {
        assignedDriverId: driverId,
        deliveryStatus: {
          in: [DeliveryStatus.ASSIGNED, DeliveryStatus.ON_THE_WAY],
        },
      },
      select: {
        id: true,
        orderNo: true,
        customerName: true,
        phone: true,
        address: true,
        note: true,
        totalAmount: true,
        deliveryStatus: true,
        assignedAt: true,
        items: { select: { productName: true, qty: true } },
      },
      orderBy: { assignedAt: 'asc' },
    });
  }

  /** Хүргэлт баталгаажуулах (зурагтай) эсвэл амжилтгүй гэж тэмдэглэх */
  async complete(
    orderId: string,
    driverId: string,
    dto: CompleteDeliveryDto,
    file?: Express.Multer.File,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('Захиалга олдсонгүй');
    }
    if (order.assignedDriverId !== driverId) {
      throw new ForbiddenException('Энэ хүргэлт танд хуваарилагдаагүй');
    }
    if (order.deliveryStatus === DeliveryStatus.DELIVERED) {
      throw new BadRequestException('Энэ захиалга аль хэдийн хүргэгдсэн');
    }

    const proofUrl = file ? `/api/uploads/${file.filename}` : null;

    if (dto.success) {
      if (!file) {
        throw new BadRequestException('Баталгаажуулах зураг заавал хэрэгтэй');
      }
      return this.prisma.order.update({
        where: { id: orderId },
        data: {
          orderStatus: OrderStatus.COMPLETED,
          deliveryStatus: DeliveryStatus.DELIVERED,
          deliveredAt: new Date(),
          deliveryProofUrl: proofUrl,
          deliveryNote: dto.note?.trim() || null,
        },
      });
    }

    if (!dto.note?.trim()) {
      throw new BadRequestException('Шалтгаан бичнэ үү');
    }
    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        deliveryStatus: DeliveryStatus.FAILED,
        deliveryNote: dto.note.trim(),
        ...(proofUrl ? { deliveryProofUrl: proofUrl } : {}),
      },
    });
  }

  /** Жолоочийн гүйцэтгэл + цалин */
  async myStats(driverId: string) {
    const weekAgo = new Date();
    weekAgo.setHours(0, 0, 0, 0);
    weekAgo.setDate(weekAgo.getDate() - 6);

    const mine: Prisma.OrderWhereInput = { assignedDriverId: driverId };

    const [totalDelivered, assignedThisWeek, deliveredThisWeek, recent, profile] =
      await Promise.all([
        this.prisma.order.count({
          where: { ...mine, deliveryStatus: DeliveryStatus.DELIVERED },
        }),
        this.prisma.order.count({
          where: { ...mine, assignedAt: { gte: weekAgo } },
        }),
        this.prisma.order.count({
          where: {
            ...mine,
            deliveryStatus: DeliveryStatus.DELIVERED,
            deliveredAt: { gte: weekAgo },
          },
        }),
        this.prisma.order.findMany({
          where: {
            ...mine,
            deliveryStatus: DeliveryStatus.DELIVERED,
            deliveredAt: { gte: weekAgo },
          },
          select: { deliveredAt: true },
        }),
        this.prisma.driverProfile.findUnique({ where: { userId: driverId } }),
      ]);

    const dayKey = (d: Date) =>
      new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
        .toISOString()
        .slice(0, 10);

    const byDay = new Map<string, { date: string; delivered: number }>();
    for (let i = 0; i < 7; i++) {
      const key = dayKey(new Date(weekAgo.getTime() + i * DAY_MS));
      byDay.set(key, { date: key, delivered: 0 });
    }
    for (const r of recent) {
      if (!r.deliveredAt) continue;
      const row = byDay.get(dayKey(r.deliveredAt));
      if (row) row.delivered += 1;
    }

    // Цалин = нийт хүргэсэн × хүргэлт тутмын хөлс (Decimal — float биш)
    const earnings = profile
      ? profile.feePerDelivery.mul(totalDelivered)
      : new Prisma.Decimal(0);

    return {
      totalDelivered,
      assignedThisWeek,
      deliveredThisWeek,
      last7Days: [...byDay.values()],
      feePerDelivery: profile?.feePerDelivery ?? null,
      earnings,
    };
  }
}
