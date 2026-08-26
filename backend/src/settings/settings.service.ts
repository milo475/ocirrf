import { BadRequestException, Injectable } from '@nestjs/common';
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
}
