import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import type { Prisma } from '../generated/prisma/client';
import { PERM } from '../permissions/permission-keys';
import { PermissionsService } from '../permissions/permissions.service';
import { OrgContext } from '../org/org-context';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    (e as { code?: string }).code === 'P2002'
  );
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  /** Өртөг нууц тоо — зөвхөн inventory.adjustment эрхтэйд харагдана */
  private async canSeeCost(user?: AuthUser) {
    if (!user) return false;
    return this.permissions.has(user.id, user.role, PERM.INVENTORY_ADJUSTMENT);
  }

  private stripCost<T extends { costPrice?: unknown }>(item: T): T {
    const copy = { ...item };
    delete copy.costPrice;
    return copy;
  }

  async findAll(query: QueryProductsDto, user?: AuthUser) {
    const {
      search,
      categoryId,
      companyId,
      isActive = true,
      lowStock,
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.ProductWhereInput = {
      isActive,
      ...(categoryId ? { categoryId } : {}),
      ...(companyId ? { companyId } : {}),
      // stockQty <= lowStockLimit — багана хоорондын харьцуулалт (field reference)
      ...(lowStock
        ? { stockQty: { lte: this.prisma.product.fields.lowStockLimit } }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
              // Barcode бүрэн таарвал шууд олдоно (V4-12 — сканнер)
              { barcode: search },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { category: true, company: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    if (!(await this.canSeeCost(user))) {
      return { items: items.map((i) => this.stripCost(i)), total, page, limit };
    }
    return { items, total, page, limit };
  }

  async findOne(id: string, user?: AuthUser) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true, company: true },
    });
    if (!product) {
      throw new NotFoundException('Бараа олдсонгүй');
    }
    if (user && !(await this.canSeeCost(user))) {
      return this.stripCost(product);
    }
    return product;
  }

  async create(dto: CreateProductDto) {
    await this.ensureCategoryExists(dto.categoryId);
    try {
      return await this.prisma.product.create({
        data: {
          organizationId: OrgContext.require(),
          sku: dto.sku,
          name: dto.name,
          price: dto.price, // string → Decimal, float-гүй
          costPrice: dto.costPrice ?? '0',
          lowStockLimit: dto.lowStockLimit,
          daysSupply: dto.daysSupply,
          categoryId: dto.categoryId,
          companyId: dto.companyId,
          unit: dto.unit,
          imageUrl: dto.imageUrl,
          isActive: dto.isActive,
        },
        include: { category: true },
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('SKU давхардаж байна');
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    await this.ensureCategoryExists(dto.categoryId);
    try {
      return await this.prisma.product.update({
        where: { id },
        data: dto,
        include: { category: true },
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('SKU давхардаж байна');
      }
      throw e;
    }
  }

  /** Байршуулсан зургийг барааны imageUrl-д холбоно (V5) */
  async setImage(id: string, filename?: string) {
    if (!filename) {
      throw new BadRequestException(
        'Зураг илгээнэ үү (jpg/png/webp, 3MB хүртэл)',
      );
    }
    await this.findOne(id);
    return this.prisma.product.update({
      where: { id },
      data: { imageUrl: `/api/uploads/${filename}` },
      include: { category: true, company: true },
    });
  }

  /** Жинхэнэ устгал биш — isActive=false (хуучин захиалгууд холбоотой) */
  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
      include: { category: true },
    });
  }

  private async ensureCategoryExists(categoryId?: string) {
    if (!categoryId) return;
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException('Ангилал олдсонгүй');
    }
  }

  // ── CSV импорт (V4-12) ──

  /** UTF-8 BOM загвар — Excel-д кирилл зөв нээгдэнэ */
  importTemplate(): string {
    return (
      '\uFEFF' +
      'SKU,Нэр,Ангилал,Үнэ,Өртөг,Barcode,Доод хязгаар,Эхний үлдэгдэл\n' +
      'UG-0101,Жишээ бараа,Хүнс,5000,3500,4870000000001,5,20\n'
    );
  }

  /**
   * CSV импорт: SKU байвал шинэчилнэ (зөвхөн бөглөсөн багануудыг),
   * байхгүй бол шинээр үүсгэж эхний үлдэгдлийг INITIAL movement-оор.
   * Мөр бүр өөрийн transaction-д — алдаатай мөр алгасагдаж бусад нь орно.
   */
  async importCsv(buffer: Buffer | undefined, user: AuthUser) {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('CSV файл илгээнэ үү (file талбар)');
    }
    const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    // Толгой мөрийг алгасна
    const start = lines[0]?.toUpperCase().includes('SKU') ? 1 : 0;
    if (lines.length <= start) {
      throw new BadRequestException('Импортлох мөр алга');
    }

    const DEC = /^\d{1,10}(\.\d{1,2})?$/;
    let created = 0;
    let updated = 0;
    const errors: { row: number; reason: string }[] = [];

    for (let i = start; i < lines.length; i++) {
      const rowNo = i + 1; // файлын мөрийн дугаар (толгой оруулаад)
      const f = parseCsvLine(lines[i]).map((s) => s.trim());
      const [sku, name, catName, price, cost, barcode, lowLimit, initQty] = f;
      try {
        if (!sku) throw new Error('SKU хоосон');
        if (price && !DEC.test(price)) throw new Error('Үнэ буруу форматтай');
        if (cost && !DEC.test(cost)) throw new Error('Өртөг буруу форматтай');
        if (lowLimit && !/^\d+$/.test(lowLimit)) {
          throw new Error('Доод хязгаар бүхэл тоо байна');
        }
        if (initQty && !/^\d+$/.test(initQty)) {
          throw new Error('Эхний үлдэгдэл бүхэл тоо байна');
        }

        const kind = await this.prisma.$transaction(async (tx) => {
          // Composite unique тул selector нь [organizationId, sku/name] хос
          const organizationId = OrgContext.require();
          let categoryId: string | undefined;
          if (catName) {
            const cat = await tx.category.upsert({
              where: { organizationId_name: { organizationId, name: catName } },
              update: {},
              create: { name: catName, organizationId },
            });
            categoryId = cat.id;
          }

          const existing = await tx.product.findUnique({
            where: { organizationId_sku: { organizationId, sku } },
          });
          if (existing) {
            await tx.product.update({
              where: { organizationId_sku: { organizationId, sku } },
              data: {
                ...(name ? { name } : {}),
                ...(price ? { price } : {}),
                ...(cost ? { costPrice: cost } : {}),
                ...(barcode ? { barcode } : {}),
                ...(lowLimit ? { lowStockLimit: parseInt(lowLimit, 10) } : {}),
                ...(categoryId ? { categoryId } : {}),
              },
            });
            return 'updated' as const;
          }

          if (!name) throw new Error('Шинэ барааны нэр хоосон');
          if (!price) throw new Error('Шинэ барааны үнэ хоосон');
          const qty = initQty ? parseInt(initQty, 10) : 0;
          const product = await tx.product.create({
            data: {
              organizationId,
              sku,
              name,
              price,
              costPrice: cost || '0',
              barcode: barcode || null,
              lowStockLimit: lowLimit ? parseInt(lowLimit, 10) : 5,
              stockQty: qty,
              categoryId,
            },
          });
          if (qty > 0) {
            await tx.stockMovement.create({
              data: {
                organizationId,
                productId: product.id,
                qtyChange: qty,
                reason: 'INITIAL',
                note: 'CSV импорт',
                userId: user.id,
              },
            });
          }
          return 'created' as const;
        });

        if (kind === 'created') created++;
        else updated++;
      } catch (e) {
        errors.push({
          row: rowNo,
          reason: isUniqueViolation(e)
            ? 'Barcode давхардсан'
            : e instanceof Error
              ? e.message
              : 'Тодорхойгүй алдаа',
        });
      }
    }

    return { created, updated, errors };
  }
}

/** CSV-ийн нэг мөрийг талбаруудад задална — "хашилт, таслал" дэмжинэ */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}
