import { Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Prisma } from '../generated/prisma/client';
import { PERM } from '../permissions/permission-keys';
import { RequirePermission } from '../permissions/require-permission.decorator';
import { PrismaService } from '../prisma/prisma.service';

class QueryActivityLogDto {
  @IsOptional()
  @IsString()
  entity?: string;

  @IsOptional()
  @IsUUID('4', { message: 'userId буруу форматтай' })
  userId?: string;

  @IsOptional()
  @IsDateString({}, { message: 'from огноо буруу форматтай (ISO)' })
  from?: string;

  @IsOptional()
  @IsDateString({}, { message: 'to огноо буруу форматтай (ISO)' })
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

@Controller('activity-log')
export class ActivityLogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission(PERM.ACTIVITY_LOG_VIEW)
  async list(@Query() query: QueryActivityLogDto) {
    const { page = 1, limit = 20 } = query;
    const where: Prisma.ActivityLogWhereInput = {
      ...(query.entity ? { entity: query.entity } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    // ActivityLog-д relation байхгүй — нэрийг тусад нь татна.
    // userId нь ХООСОН байж болно (V5): амжилтгүй нэвтрэлтэд
    // хэрэглэгч танигдаагүй байдаг.
    const userIds = [
      ...new Set(items.map((i) => i.userId).filter((v): v is string => !!v)),
    ];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true },
    });
    const nameById = new Map(users.map((u) => [u.id, u.fullName]));

    return {
      items: items.map((i) => ({
        ...i,
        userName: (i.userId ? nameById.get(i.userId) : null) ?? '—',
      })),
      total,
      page,
      limit,
    };
  }
}
