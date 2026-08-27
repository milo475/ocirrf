import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { OrderStatus, Prisma } from '../generated/prisma/client';
import { formatFullAddress } from '../orders/address.util';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

/** Харилцагчид харагдах хязгаарлагдмал талбарууд */
const PORTAL_ORDER_SELECT = {
  id: true,
  orderNo: true,
  customerName: true,
  phone: true,
  region: true,
  district: true,
  khoroo: true,
  building: true,
  entrance: true,
  floor: true,
  door: true,
  province: true,
  soum: true,
  transport: true,
  addressDetail: true,
  note: true,
  totalAmount: true,
  deliveryFee: true,
  paymentStatus: true,
  paidAmount: true,
  orderStatus: true,
  deliveryStatus: true,
  deliveryProofUrl: true,
  deliveredAt: true,
  createdAt: true,
  customerId: true,
  items: {
    select: {
      id: true,
      productName: true,
      qty: true,
      priceAtOrder: true,
      lineTotal: true,
    },
  },
  // Жолоочийн зөвхөн НЭР — утас гэх мэт бусад мэдээлэл орохгүй
  assignedDriver: { select: { fullName: true } },
} satisfies Prisma.OrderSelect;

@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly settings: SettingsService,
  ) {}

  /** Settings-ийн allowCustomerCancel түлхүүрээс уншина */
  private allowCustomerCancel() {
    return this.settings.isEnabled('allowCustomerCancel');
  }

  async myOrders(
    userId: string,
    status: OrderStatus | undefined,
    page = 1,
    limit = 20,
  ) {
    const where: Prisma.OrderWhereInput = {
      customerId: userId,
      ...(status ? { orderStatus: status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        select: PORTAL_ORDER_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);
    return {
      items: items.map((o) => ({ ...o, fullAddress: formatFullAddress(o) })),
      total,
      page,
      limit,
    };
  }

  async myOrder(userId: string, id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: PORTAL_ORDER_SELECT,
    });
    if (!order) {
      throw new NotFoundException('Захиалга олдсонгүй');
    }
    if (order.customerId !== userId) {
      throw new ForbiddenException('Энэ захиалга таных биш');
    }
    return {
      ...order,
      fullAddress: formatFullAddress(order),
      // Frontend [Цуцлах] товчоо үүгээр харуулна
      canCancel:
        order.orderStatus === OrderStatus.NEW &&
        (await this.allowCustomerCancel()),
    };
  }

  /** Захиалгын wizard-ын барааны хайлт — хязгаарлагдмал талбарууд */
  async searchProducts(search: string | undefined, limit = 8) {
    const items = await this.prisma.product.findMany({
      where: {
        isActive: true,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
                // Barcode бүрэн таарвал шууд олдоно (V4-12)
                { barcode: search },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        sku: true,
        name: true,
        price: true,
        stockQty: true,
        unit: true,
      },
      orderBy: { name: 'asc' },
      take: limit,
    });
    return { items };
  }

  async dashboard(userId: string) {
    const [totalOrders, activeOrders, recentOrders] = await Promise.all([
      this.prisma.order.count({ where: { customerId: userId } }),
      this.prisma.order.count({
        where: {
          customerId: userId,
          orderStatus: {
            notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
          },
        },
      }),
      this.prisma.order.findMany({
        where: { customerId: userId },
        select: {
          id: true,
          orderNo: true,
          orderStatus: true,
          deliveryStatus: true,
          totalAmount: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);
    return { totalOrders, activeOrders, recentOrders };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) data.fullName = dto.name.trim();
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.password !== undefined) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Өөрчлөх зүйл алга');
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, username: true, fullName: true, phone: true },
    });
    return {
      id: user.id,
      email: user.username,
      name: user.fullName,
      phone: user.phone,
    };
  }

  /** Зөвхөн NEW статустай ӨӨРИЙН захиалгыг, тохиргоо нээлттэй үед */
  async cancelOrder(user: AuthUser, id: string) {
    if (!(await this.allowCustomerCancel())) {
      throw new ForbiddenException('Захиалга цуцлах боломж хаагдсан байна');
    }
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: { customerId: true, orderStatus: true },
    });
    if (!order) {
      throw new NotFoundException('Захиалга олдсонгүй');
    }
    if (order.customerId !== user.id) {
      throw new ForbiddenException('Энэ захиалга таных биш');
    }
    if (order.orderStatus !== OrderStatus.NEW) {
      throw new BadRequestException(
        'Зөвхөн шинэ (баталгаажаагүй) захиалгыг цуцлах боломжтой',
      );
    }
    // Үлдэгдэл буцаах transaction — staff-ийн цуцлалттай ЯГ ижил зам
    return this.ordersService.updateStatus(id, OrderStatus.CANCELLED, user);
  }
}
