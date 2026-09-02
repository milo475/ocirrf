import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { orgScopeExtension } from './org-scope.extension';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
      }),
    });
    /**
     * ORG-SCOPE (Multi-tenancy): $extends нь ШИНЭ proxy client буцаадаг
     * тул constructor-оос шууд буцаана. Proxy нь мэдэхгүй property-гоо
     * үндсэн instance руу дамжуулдаг тул onModuleInit/$transaction
     * зэрэг нь хэвээр ажиллана. 28 хэрэглэгч файлын хувьд type ч,
     * хэрэглээ ч өөрчлөгдөхгүй (query extension нь model-уудын type-ийг
     * өөрчилдөггүй).
     */
    return this.$extends(orgScopeExtension) as unknown as this;
  }

  async onModuleInit() {
    await this.$connect();
  }

  // main.ts дээрх app.enableShutdownHooks()-той хамт ажиллана
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
