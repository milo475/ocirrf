import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrgContext } from '../org/org-context';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    (e as { code?: string }).code === 'P2002'
  );
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  async create(dto: CreateCategoryDto) {
    try {
      return await this.prisma.category.create({
        data: { name: dto.name, organizationId: OrgContext.require() },
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('Ийм нэртэй ангилал аль хэдийн байна');
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.ensureExists(id);
    try {
      return await this.prisma.category.update({
        where: { id },
        data: dto,
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('Ийм нэртэй ангилал аль хэдийн байна');
      }
      throw e;
    }
  }

  async remove(id: string) {
    await this.ensureExists(id);

    const productCount = await this.prisma.product.count({
      where: { categoryId: id },
    });
    if (productCount > 0) {
      throw new ConflictException(
        `Энэ ангилалд ${productCount} бараа бүртгэлтэй тул устгах боломжгүй`,
      );
    }

    return this.prisma.category.delete({ where: { id } });
  }

  private async ensureExists(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Ангилал олдсонгүй');
    }
    return category;
  }
}
