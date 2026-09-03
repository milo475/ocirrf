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
  OrderStatus,
  Prisma,
} from '../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { OrgContext } from '../org/org-context';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { PublicOrderRequestDto } from './dto/public-order-request.dto';

@Injectable()
export class OrderRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    private readonly orders: OrdersService,
  ) {}

  /**
   * Линкийн нууц — БАЙГУУЛЛАГА БҮРТ тусдаа (Multi-tenancy).
   * Organization.publicOrderToken баганад хадгалагдана: нийтийн
   * endpoint token-оороо байгууллагаа олдог тул глобал unique.
   * Байхгүй бол эхний дуудлагад үүсгэнэ.
   */
  async getOrCreateToken(): Promise<string> {
    const organizationId = OrgContext.require();
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { publicOrderToken: true },
    });
    if (org.publicOrderToken) return org.publicOrderToken;
    // 128 бит — таах/мөргөлдөх боломжгүй (өмнөх 48 битийг өргөтгөв)
    const token = randomBytes(16).toString('base64url');
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { publicOrderToken: token },
    });
    return token;
  }

  /** Нууцыг шинэчилнэ — спам ирвэл хуучин линк хүчингүй болно */
  async rotateToken(): Promise<string> {
    const token = randomBytes(16).toString('base64url');
    await this.prisma.organization.update({
      where: { id: OrgContext.require() },
      data: { publicOrderToken: token },
    });
    return token;
  }

  /**
   * Нийтийн token-оос байгууллагыг ТОГТООНО (Multi-tenancy-ийн гол
   * цэг): үүнээс хойшхи бүх query тухайн байгууллагад хязгаарлагдана.
   */
  private async resolveOrg(token?: string) {
    if (!token) {
      throw new NotFoundException('Линк хүчингүй байна');
    }
    const org = await this.prisma.organization.findUnique({
      where: { publicOrderToken: token },
      select: { id: true, isActive: true },
    });
    if (!org || !org.isActive) {
      throw new NotFoundException('Линк хүчингүй байна');
    }
    OrgContext.set(org.id);
  }

  /**
   * Нийтийн маягтын өгөгдөл. ЗӨВХӨН хэрэглэгчид хэрэгтэйг буцаана —
   * үлдэгдлийн тоо, SKU, өртөг гадагш гарахгүй (зөвхөн "байгаа эсэх").
   */
  async publicForm(token?: string) {
    await this.resolveOrg(token);
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
    await this.resolveOrg(token);

    /**
     * ГҮЙЛГЭЭНИЙ БАРИМТ ЗААВАЛ (V5).
     *
     * Компани бэлэн мөнгөөр үйлчлэхгүй тул «дараа төлнө» гэсэн зам
     * байхгүй: линкээр захиалахын тулд эхлээд шилжүүлж, баримтаа
     * хавсаргана. Баримтгүй хүсэлт нь ажилтанд шалгах юмгүй, зөвхөн
     * дарааллыг дүүргэдэг.
     */
    if (!proofFilename) {
      throw new BadRequestException(
        'Гүйлгээний баримтын зураг заавал. Төлбөрөө шилжүүлээд ' +
          'баримтаа хавсаргана уу.',
      );
    }

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
        organizationId: OrgContext.require(),
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
        // Баримтгүйгээр энд хүрэхгүй тул үргэлж true (V5).
        // Энэ нь «үйлчлүүлэгч төлсөн гэж мэдүүлсэн» гэсэн утгатай —
        // ажилтан дансаа шалгаж баталгаажуулах хүртэл захиалга болохгүй.
        paid: true,
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

    // Хонх БОРЛУУЛАГЧ дээр дуугарна (V5) — хүсэлт хүлээж авах нь
    // тэдний ажил. Борлуулагчгүй бол ADMIN/MANAGER руу унана.
    await this.notifications.notifyOrderRequest(request);

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
  /**
   * Хүсэлтийг ЗАХИАЛГА болгоно.
   *
   * ═══ ТӨЛБӨР УРЬДЧИЛЖ ОРСОН БАЙХ ЁСТОЙ (V5) ═══
   * Компанийн дүрэм: бэлэн мөнгөөр үйлчлэхгүй, мөнгө дансанд орсны
   * ДАРАА л бараа хөдөлнө. Тиймээс захиалга үүсэх нөхцөл нь
   * «ажилтан данс дээрээ мөнгийг ХАРСАН» явдал.
   *
   * Үйлчлүүлэгчийн дарсан «Төлбөрөө хийсэн» товч нь ЗӨВХӨН МЭДҮҮЛЭГ —
   * баримт биш. Өмнө нь систем түүнд шууд итгэж, захиалгыг ТӨЛСӨН
   * гэж үүсгээд орлого бичдэг байв. Мөнгө ороогүй байсан ч.
   *
   * Одоо ажилтан `paymentConfirmed: true` гэж ТУСГАЙЛАН баталгаажуулна.
   * Мөнгө ороогүй бол энэ биш, `reject`-ийг ашиглана.
   */
  async convert(id: string, user: AuthUser, paymentConfirmed: boolean) {
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
    if (!paymentConfirmed) {
      throw new BadRequestException(
        'Дансанд мөнгө орсныг баталгаажуулаагүй байна. Мөнгө ороогүй бол ' +
          'хүсэлтийг «Төлбөр ороогүй» гэж татгалзана уу.',
      );
    }

    /**
     * ХҮСЭЛТИЙГ ЭХЛЭЭД ЭЗЭМШИНЭ (V5 засвар).
     *
     * Дээрх `status !== NEW` шалгалт нь энгийн уншилт байсан бөгөөд
     * захиалга үүсгэх, баталгаажуулах, хүсэлтийг CONVERTED болгох гурав нь
     * ТУСДАА транзакц байв. Тиймээс «Захиалга болгох» товчийг хоёр удаа
     * дарахад хоёр хүсэлт хоёулаа NEW-г уншиж, ХОЁР захиалга үүсгэж,
     * үлдэгдлийг хоёр удаа хасаж, нэг гүйлгээнд хоёр Payment + хоёр INCOME
     * бичилт үүсгэдэг байсан.
     *
     * Одоо нөхцөлт `updateMany`-гээр төлөвийг атомоор эзэмшинэ: хоёр дахь
     * хүсэлт 0 мөр өөрчилж, тэндээ зогсоно.
     */
    const claimed = await this.prisma.orderRequest.updateMany({
      where: { id, status: OrderRequestStatus.NEW },
      data: {
        status: OrderRequestStatus.CONVERTED,
        handledById: user.id,
        handledAt: new Date(),
      },
    });
    if (claimed.count === 0) {
      throw new BadRequestException('Энэ хүсэлт аль хэдийн боловсруулагдсан');
    }

    try {
      return await this.buildOrderFromRequest(id, request, user);
    } catch (e) {
      // Захиалга үүсэхгүй бол эзэмшлийг БУЦААНА — эс тэгвэл хүсэлт
      // захиалгагүйгээр CONVERTED болж гацна.
      await this.prisma.orderRequest.updateMany({
        where: { id, status: OrderRequestStatus.CONVERTED, orderId: null },
        data: {
          status: OrderRequestStatus.NEW,
          handledById: null,
          handledAt: null,
        },
      });
      throw e;
    }
  }

  /** convert-ийн хоёр дахь хэсэг — хүсэлт эзэмшигдсэний ДАРАА ажиллана */
  private async buildOrderFromRequest(
    id: string,
    request: { items: { productId: string; qty: number }[] } & Record<
      string,
      any
    >,
    user: AuthUser,
  ) {
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
        // Үйлчлүүлэгчийн мэдүүлэг биш — АЖИЛТНЫ баталгаажуулалт
        paid: true,
        items: request.items.map((i) => ({
          productId: i.productId,
          qty: i.qty,
        })),
      },
      user,
    );

    /**
     * «Захиалга болгох» дарах нь өөрөө БАТАЛГААЖУУЛАЛТ (V5) — ажилтан
     * гүйлгээний баримт, хаяг, барааг шалгасны эцэст л дардаг. NEW-д
     * үлдээвэл жолооч хуваарилахын өмнө утгагүй нэг товч нэмэгддэг
     * (assignDriver нь CONFIRMED-ээс дээш төлөв шаарддаг).
     */
    const confirmed = await this.orders.updateStatus(
      order.id,
      OrderStatus.CONFIRMED,
      user,
    );

    // Төлөв/handled* нь эзэмших алхамд аль хэдийн бичигдсэн — энд зөвхөн
    // үүссэн захиалгын холбоосыг нэмнэ.
    await this.prisma.orderRequest.update({
      where: { id },
      data: { orderId: order.id },
    });
    return confirmed;
  }

  /** Хогийн/буруу хүсэлт — устгахгүй, зөвхөн тэмдэглэнэ */
  /**
   * Хүсэлтээс татгалзана.
   *
   * Гол хэрэглээ нь «мөнгө ороогүй»: үйлчлүүлэгч төлсөн гэж
   * тэмдэглэсэн ч данс дээр байхгүй. Шалтгааныг бичиж үлдээвэл
   * давтан оролдлого хийдэг дугаарыг хожим таних боломжтой.
   */
  async reject(id: string, user: AuthUser, reason?: string) {
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
        rejectReason: reason?.trim() || null,
        handledById: user.id,
        handledAt: new Date(),
      },
    });
  }
}
