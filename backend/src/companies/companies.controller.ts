import {
  Body,
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
