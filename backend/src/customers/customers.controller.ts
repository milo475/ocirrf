import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { Prisma, Role } from '../generated/prisma/client';
import { PERM } from '../permissions/permission-keys';
import { RequirePermission } from '../permissions/require-permission.decorator';
import { PrismaService } from '../prisma/prisma.service';

class SetActiveDto {
  @IsBoolean({ message: 'isActive нь boolean байна' })
  isActive: boolean;
}

@Controller('customers')
export class CustomersController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Харилцагчид — өөр компаниас бараа нийлүүлдэг түнш хүмүүс.
   * Системд OPERATOR эрхээр бүртгэгддэг (захиалга шивэх эрхтэй) тул
   * тэднийг захиалгын статистиктай нь жагсаана.
   */
  @Get('partners')
  @RequirePermission(PERM.CUSTOMERS_VIEW)
  async partners() {
    const users = await this.prisma.user.findMany({
      where: { role: Role.OPERATOR },
      select: {
        id: true,
        username: true,
        fullName: true,
        phone: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    const stats = await this.prisma.order.groupBy({
      by: ['createdById'],
      where: { createdById: { in: users.map((u) => u.id) } },
      _count: { _all: true },
      _sum: { totalAmount: true },
      _max: { createdAt: true },
    });
    const byId = new Map(stats.map((s) => [s.createdById, s]));
    return users.map((u) => {
      const s = byId.get(u.id);
      return {
        id: u.id,
        email: u.username,
        name: u.fullName,
        phone: u.phone,
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt,
        orders: s?._count._all ?? 0,
        totalAmount: s?._sum.totalAmount ?? 0,
        lastOrderAt: s?._max.createdAt ?? null,
      };
    });
  }

  /** Бүртгэлтэй (portal) харилцагчид — захиалгын тоо/нийт дүнтэй */
  @Get('registered')
  @RequirePermission(PERM.CUSTOMERS_VIEW)
  async registered() {
    const [users, sums] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: Role.CUSTOMER },
        select: {
          id: true,
          username: true,
          fullName: true,
          phone: true,
          isActive: true,
          createdAt: true,
          _count: { select: { customerOrders: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.groupBy({
        by: ['customerId'],
        where: { customerId: { not: null } },
        _sum: { totalAmount: true },
      }),
    ]);
    const sumById = new Map(sums.map((s) => [s.customerId, s._sum.totalAmount]));
    return users.map((u) => ({
      id: u.id,
      email: u.username,
      name: u.fullName,
      phone: u.phone,
      isActive: u.isActive,
      createdAt: u.createdAt,
      orders: u._count.customerOrders,
      totalAmount: sumById.get(u.id) ?? 0,
    }));
  }

  /** Утасны захиалгаас бүлэглэсэн харилцагчид */
  @Get('by-phone')
  @RequirePermission(PERM.CUSTOMERS_VIEW)
  async byPhone() {
    const groups = await this.prisma.order.groupBy({
      by: ['phone'],
      _count: { _all: true },
      _sum: { totalAmount: true },
      _max: { createdAt: true },
      orderBy: { _count: { phone: 'desc' } },
      take: 100,
    });
    const names = await this.prisma.order.findMany({
      where: { phone: { in: groups.map((g) => g.phone) } },
      select: { phone: true, customerName: true },
      distinct: ['phone', 'customerName'] as Prisma.OrderScalarFieldEnum[],
    });
    const namesByPhone = new Map<string, string[]>();
    for (const n of names) {
      if (!n.customerName) continue;
      const list = namesByPhone.get(n.phone) ?? [];
      if (!list.includes(n.customerName)) list.push(n.customerName);
      namesByPhone.set(n.phone, list);
    }
    return groups.map((g) => ({
      phone: g.phone,
      names: namesByPhone.get(g.phone) ?? [],
      orders: g._count._all,
      totalAmount: g._sum.totalAmount ?? 0,
      lastOrderAt: g._max.createdAt,
    }));
  }

  /** Portal харилцагчийг идэвхгүй/идэвхтэй болгох */
  @Patch(':id/active')
  @RequirePermission(PERM.CUSTOMERS_EDIT)
  async setActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetActiveDto,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.role !== Role.CUSTOMER) {
      throw new NotFoundException('Харилцагч олдсонгүй');
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: dto.isActive },
      select: { id: true, isActive: true },
    });
    return updated;
  }
}
