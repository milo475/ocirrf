import { BadRequestException, Injectable } from '@nestjs/common';
import { DeliveryRegion, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Нэвтэрсэн бүх хэрэглэгчид харагдах public түлхүүрүүд + default утга */
export const PUBLIC_SETTINGS: Record<string, string> = {
  companyName: 'ursGAL',
  companyPhone: '',
  allowCustomerCancel: 'false',
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public түлхүүрүүд — DB-д байхгүй бол default */
  async getPublic(): Promise<Record<string, string>> {
    const rows = await this.prisma.setting.findMany({
      where: { key: { in: Object.keys(PUBLIC_SETTINGS) } },
    });
    const out = { ...PUBLIC_SETTINGS };
    for (const r of rows) out[r.key] = r.value;
    return out;
  }

  async get(key: string): Promise<string> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    return row?.value ?? PUBLIC_SETTINGS[key] ?? '';
  }

  async isEnabled(key: string): Promise<boolean> {
    return (await this.get(key)) === 'true';
  }

  /** Зөвшөөрөгдсөн түлхүүрүүдийг upsert-ээр хадгална */
  async setMany(entries: Record<string, string>) {
    for (const [key, value] of Object.entries(entries)) {
      if (!(key in PUBLIC_SETTINGS)) {
        throw new BadRequestException(`Буруу тохиргооны түлхүүр: ${key}`);
      }
      if (
        key === 'allowCustomerCancel' &&
        value !== 'true' &&
        value !== 'false'
      ) {
        throw new BadRequestException(
          'allowCustomerCancel нь "true" эсвэл "false" байна',
        );
      }
      if (typeof value !== 'string') {
        throw new BadRequestException('Тохиргооны утга string байна');
      }
    }
    await this.prisma.$transaction(
      Object.entries(entries).map(([key, value]) =>
        this.prisma.setting.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        }),
      ),
    );
    return this.getPublic();
  }

  // ── Хүргэлтийн тариф (V4-05) ──

  /** Бүх тариф — default (district=null) мөрүүд эхэндээ */
  async tariffs() {
    const rows = await this.prisma.deliveryTariff.findMany({
      orderBy: [{ region: 'asc' }, { district: 'asc' }],
    });
    // default-ууд region бүрийн эхэнд
    return rows.sort((a, b) =>
      a.region === b.region
        ? (a.district === null ? -1 : 1) - (b.district === null ? -1 : 1)
        : a.region.localeCompare(b.region),
    );
  }

  /** Тарифуудыг бүхэлд нь солино — region бүрийн default заавал байна */
  async setTariffs(
    list: { region: DeliveryRegion; district?: string | null; fee: string }[],
  ) {
    const keys = new Set<string>();
    for (const t of list) {
      const key = `${t.region}:${t.district ?? ''}`;
      if (keys.has(key)) {
        throw new BadRequestException('Тариф давхардаж байна');
      }
      keys.add(key);
      if (new Prisma.Decimal(t.fee).lt(0)) {
        throw new BadRequestException('Тариф 0-ээс багагүй байна');
      }
    }
    for (const region of Object.values(DeliveryRegion)) {
      if (!keys.has(`${region}:`)) {
        throw new BadRequestException(
          `${region} бүсийн default тариф заавал байна`,
        );
      }
    }
    await this.prisma.$transaction([
      this.prisma.deliveryTariff.deleteMany({}),
      this.prisma.deliveryTariff.createMany({
        data: list.map((t) => ({
          region: t.region,
          district: t.district?.trim() || null,
          fee: new Prisma.Decimal(t.fee),
        })),
      }),
    ]);
    return this.tariffs();
  }

  /** Хаягийн тариф: дүүргийн тусгай тариф байвал түүнийг, үгүй бол default */
  async feeFor(
    region: DeliveryRegion,
    district?: string | null,
  ): Promise<Prisma.Decimal> {
    if (region === DeliveryRegion.ULAANBAATAR && district) {
      const specific = await this.prisma.deliveryTariff.findFirst({
        where: { region, district },
      });
      if (specific) return specific.fee;
    }
    const def = await this.prisma.deliveryTariff.findFirst({
      where: { region, district: null },
    });
    return def?.fee ?? new Prisma.Decimal(0);
  }
}
