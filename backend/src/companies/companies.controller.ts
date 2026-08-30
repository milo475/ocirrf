import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '../generated/prisma/client';
import { PERM } from '../permissions/permission-keys';
import { RequirePermission } from '../permissions/require-permission.decorator';
import { PrismaService } from '../prisma/prisma.service';

class CompanyDto {
  @IsString()
  @MinLength(2, { message: 'Компанийн нэр хамгийн багадаа 2 тэмдэгт' })
  name: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

/** Урсгал доторх хурдан үүсгэлт — хамгийн цөөн талбар */
class QuickCompanyDto {
  @IsString()
  @MinLength(2, { message: 'Компанийн нэр хамгийн багадаа 2 тэмдэгт' })
  name: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Компанийн нэр хамгийн багадаа 2 тэмдэгт' })
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * Харилцагч компаниуд (V5) — бараа нийлүүлдэг түнш байгууллагууд.
 * Компани тус бүрд хэдэн оператор (=Харилцагч эрхтэй хэрэглэгч) болон
 * хэдэн бараа харьяалагдаж байгааг хамт буцаана.
 */
@Controller('companies')
export class CompaniesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission(PERM.CUSTOMERS_VIEW)
  async list() {
    const companies = await this.prisma.company.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
    // Операторын тоог тусад нь — role шүүлттэй тул _count-д багтахгүй
    const operators = await this.prisma.user.groupBy({
      by: ['companyId'],
      where: { companyId: { not: null }, role: Role.OPERATOR },
      _count: { _all: true },
    });
    const opBy = new Map(operators.map((o) => [o.companyId, o._count._all]));
    return companies.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      note: c.note,
      isActive: c.isActive,
      createdAt: c.createdAt,
      products: c._count.products,
      operators: opBy.get(c.id) ?? 0,
    }));
  }

  @Post()
  @RequirePermission(PERM.CUSTOMERS_EDIT)
  create(@Body() dto: CompanyDto) {
    return this.prisma.company.create({ data: dto });
  }

  /**
   * Нийлүүлэлтийн урсгал доторх ХУРДАН ҮҮСГЭЛТ (V5).
   *
   * Нийлүүлэлт бүртгэхэд компани заавал хэрэгтэй атал компани үүсгэх нь
   * customers.edit (зөвхөн админ) байсан тул supplies.create эрхтэй
   * менежер/нярав урсгалынхаа дундуур гацдаг байв. Урсгалыг эзэмшдэг
   * эрх тухайн урсгалын заавал алхмаа хийж чадах ёстой.
   *
   * Зөвхөн ҮҮСГЭНЭ — засах/устгах нь customers.edit-д хэвээр үлдэнэ.
   * Үүссэн компани Харилцагчид хуудсанд бусадтай адил харагдана.
   */
  @Post('quick')
  @RequirePermission(PERM.SUPPLIES_CREATE)
  async quickCreate(@Body() dto: QuickCompanyDto) {
    const name = dto.name.trim();
    const existing = await this.prisma.company.findUnique({ where: { name } });
    if (existing) {
      throw new ConflictException({
        message: `«${name}» нэртэй компани бүртгэлтэй байна`,
        existing: {
          id: existing.id,
          name: existing.name,
          isActive: existing.isActive,
        },
      });
    }
    return this.prisma.company.create({
      data: {
        name,
        phone: dto.phone?.trim() || null,
      },
    });
  }

  @Patch(':id')
  @RequirePermission(PERM.CUSTOMERS_EDIT)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    const exists = await this.prisma.company.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException('Компани олдсонгүй');
    }
    return this.prisma.company.update({ where: { id }, data: dto });
  }
}
