import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import {
  DeliveryRegion,
  OrderChannel,
  OrderRequestStatus,
  Prisma,
} from '../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { PublicOrderRequestDto } from './dto/public-order-request.dto';

/** Нийтийн линкийн нууц хэсэг Setting-д хадгалагдана */
export const PUBLIC_TOKEN_KEY = 'publicOrderToken';

@Injectable()
export class OrderRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    private readonly orders: OrdersService,
  ) {}

  /** Линкийн нууц — байхгүй бол үүсгэнэ (эхний дуудлагад) */
  async getOrCreateToken(): Promise<string> {
    const row = await this.prisma.setting.findUnique({
      where: { key: PUBLIC_TOKEN_KEY },
    });
    if (row?.value) return row.value;
    const token = randomBytes(6).toString('base64url');
    await this.prisma.setting.upsert({
      where: { key: PUBLIC_TOKEN_KEY },
      create: { key: PUBLIC_TOKEN_KEY, value: token },
      update: { value: token },
    });
    return token;
  }

  /** Нууцыг шинэчилнэ — спам ирвэл хуучин линк хүчингүй болно */
  async rotateToken(): Promise<string> {
    const token = randomBytes(6).toString('base64url');
    await this.prisma.setting.upsert({
      where: { key: PUBLIC_TOKEN_KEY },
      create: { key: PUBLIC_TOKEN_KEY, value: token },
      update: { value: token },
    });
    return token;
  }

  private async assertToken(token?: string) {
    const current = await this.getOrCreateToken();
    if (!token || token !== current) {
      throw new NotFoundException('Линк хүчингүй байна');
    }
  }

  /**
   * Нийтийн маягтын өгөгдөл. ЗӨВХӨН хэрэглэгчид хэрэгтэйг буцаана —
   * үлдэгдлийн тоо, SKU, өртөг гадагш гарахгүй (зөвхөн "байгаа эсэх").
   */
  async publicForm(token?: string) {
    await this.assertToken(token);
    const [settings, products] = await Promise.all([
      this.settings.getPublic(),
      this.prisma.product.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          price: true,
          unit: true,
          imageUrl: true,
          stockQty: true,
          category: { select: { name: true } },
        },
        orderBy: { name: 'asc' },
      }),
    ]);
    return {
      companyName: settings.companyName,
      companyPhone: settings.companyPhone,
      bank: {
        name: settings.bankName,
        account: settings.bankAccount,
        holder: settings.bankHolder,
      },
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        unit: p.unit,
        imageUrl: p.imageUrl,
        category: p.category?.name ?? null,
        inStock: p.stockQty > 0,
      })),
    };
  }

  /** Хэрэглэгчийн илгээсэн хүсэлт — үлдэгдэл хөдлөхгүй */
  async submit(
    token: string | undefined,
    dto: PublicOrderRequestDto,
    proofFilename?: string,
  ) {
    await this.assertToken(token);

    const ids = dto.items.map((i) => i.productId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Нэг бараа давхардаж орсон байна');
    }
    const found = await this.prisma.product.count({
      where: { id: { in: ids }, isActive: true },
    });
    if (found !== ids.length) {
      throw new BadRequestException('Сонгосон бараа олдсонгүй');
    }

    const isUB = dto.region === DeliveryRegion.ULAANBAATAR;
    const request = await this.prisma.orderRequest.create({
      data: {
        customerName: dto.customerName.trim(),
        phone: dto.phone,
        extraPhone: dto.extraPhone ?? null,
        socialName: dto.socialName?.trim() || null,
        channel: dto.channel ?? OrderChannel.OTHER,
        region: dto.region,
        district: isUB ? dto.district : null,
        khoroo: isUB ? dto.khoroo : null,
        building: isUB ? dto.building : null,
        entrance: isUB ? dto.entrance : null,
        floor: isUB ? dto.floor : null,
        door: isUB ? dto.door : null,
        province: isUB ? null : dto.province,
        soum: isUB ? null : dto.soum,
        transport: isUB ? null : (dto.transport ?? null),
        addressDetail: dto.addressDetail ?? null,
        note: dto.note ?? null,
        paid: dto.paid === true,
        paymentProofUrl: proofFilename ? `/api/uploads/${proofFilename}` : null,
        items: {
          create: dto.items.map((i) => ({
            productId: i.productId,
            qty: i.qty,
          })),
        },
      },
      include: { items: true },
    });

    // Ажилтнуудад хонх дуугарна (SSE) — шууд харж боловсруулна
    const staff = await this.prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'MANAGER', 'OPERATOR'] }, isActive: true },
      select: { id: true },
    });
    await this.notifications.notify(
      staff.map((u) => u.id),
      {
        type: 'ORDER_REQUEST',
        title: `Шинэ захиалгын хүсэлт: ${request.customerName}`,
        body: `${request.phone}${request.socialName ? ` · ${request.socialName}` : ''}`,
        refType: 'order-request',
        refId: request.id,
      },
    );

    return { ok: true, id: request.id };
  }

  /** Ажилтны жагсаалт — барааны нэр/үнэтэй нь хамт */
  async list(status: OrderRequestStatus = OrderRequestStatus.NEW) {
    const requests = await this.prisma.orderRequest.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { items: true },
    });
    const productIds = [
      ...new Set(requests.flatMap((r) => r.items.map((i) => i.productId))),
    ];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, price: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    return requests.map((r) => {
      const items = r.items.map((i) => ({
        productId: i.productId,
        qty: i.qty,
        name: byId.get(i.productId)?.name ?? '?',
        price: byId.get(i.productId)?.price ?? new Prisma.Decimal(0),
      }));
      return {
        ...r,
        items,
        total: items.reduce(
          (a, i) => a.add(new Prisma.Decimal(i.price).mul(i.qty)),
          new Prisma.Decimal(0),
        ),
      };
    });
  }

  /**
   * Хүсэлтийг жинхэнэ захиалга болгоно — ЭНД л үлдэгдэл хасагдана.
   * Захиалга үүсгэх бүх дүрэм (үлдэгдэл шалгах, orderNo, төлбөр)
   * OrdersService-ийнхээрээ явна.
   */
  async convert(id: string, user: AuthUser) {
    const request = await this.prisma.orderRequest.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!request) {
      throw new NotFoundException('Хүсэлт олдсонгүй');
    }
    if (request.status !== OrderRequestStatus.NEW) {
      throw new BadRequestException('Энэ хүсэлт аль хэдийн боловсруулагдсан');
    }

    const order = await this.orders.create(
      {
        customerName: request.customerName,
        customerPhone: request.phone,
        extraPhone: request.extraPhone ?? undefined,
        region: request.region,
        district: request.district ?? undefined,
        khoroo: request.khoroo ?? undefined,
        building: request.building ?? undefined,
        entrance: request.entrance ?? undefined,
        floor: request.floor ?? undefined,
        door: request.door ?? undefined,
        province: request.province ?? undefined,
        soum: request.soum ?? undefined,
        transport: request.transport ?? undefined,
        addressDetail: request.addressDetail ?? undefined,
        note: request.note ?? undefined,
        channel: request.channel,
        paid: request.paid,
        items: request.items.map((i) => ({
          productId: i.productId,
          qty: i.qty,
        })),
      },
      user,
    );

    await this.prisma.orderRequest.update({
      where: { id },
      data: {
        status: OrderRequestStatus.CONVERTED,
        orderId: order.id,
        handledById: user.id,
        handledAt: new Date(),
      },
    });
    return order;
  }

  /** Хогийн/буруу хүсэлт — устгахгүй, зөвхөн тэмдэглэнэ */
  async reject(id: string, user: AuthUser) {
    const request = await this.prisma.orderRequest.findUnique({
      where: { id },
    });
    if (!request) {
      throw new NotFoundException('Хүсэлт олдсонгүй');
    }
    return this.prisma.orderRequest.update({
      where: { id },
      data: {
        status: OrderRequestStatus.REJECTED,
        handledById: user.id,
        handledAt: new Date(),
      },
    });
  }
}
