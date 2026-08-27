import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import type { Prisma } from '../generated/prisma/client';
import { PERM } from '../permissions/permission-keys';
import { PermissionsService } from '../permissions/permissions.service';
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
      isActive = true,
      lowStock,
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.ProductWhereInput = {
      isActive,
      ...(categoryId ? { categoryId } : {}),
      // stockQty <= lowStockLimit — багана хоорондын харьцуулалт (field reference)
      ...(lowStock
        ? { stockQty: { lte: this.prisma.product.fields.lowStockLimit } }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { category: true },
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
      include: { category: true },
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
          sku: dto.sku,
          name: dto.name,
          price: dto.price, // string → Decimal, float-гүй
          costPrice: dto.costPrice ?? '0',
          lowStockLimit: dto.lowStockLimit,
          categoryId: dto.categoryId,
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
}
