import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { CategoriesModule } from './categories/categories.module';
import { PrismaModule } from './prisma/prisma.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DeliveryModule } from './delivery/delivery.module';
import { FinanceModule } from './finance/finance.module';
import { OrdersModule } from './orders/orders.module';
import { PermissionsGuard } from './permissions/permissions.guard';
import { PermissionsModule } from './permissions/permissions.module';
import { ProductsModule } from './products/products.module';
import { StockModule } from './stock/stock.module';
import { UPLOADS_DIR } from './uploads.config';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // frontend/dist-ийг нэг порт дээрээс serve хийнэ:
    // /api/* backend-д, бусад бүх зам SPA-ийн index.html руу.
    // uploads/ — хүргэлтийн баталгаажуулах зургууд /api/uploads/* дээр.
    ServeStaticModule.forRoot(
      {
        rootPath: join(__dirname, '..', '..', 'frontend', 'dist'),
        exclude: ['/api/{*path}'],
      },
      {
        rootPath: UPLOADS_DIR, // .env-ийн UPLOADS_DIR эсвэл backend/uploads
        serveRoot: '/api/uploads',
        serveStaticOptions: { index: false },
      },
    ),
    PrismaModule,
    PermissionsModule,
    AuthModule,
    CategoriesModule,
    ProductsModule,
    StockModule,
    OrdersModule,
    DashboardModule,
    DeliveryModule,
    FinanceModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [
    // Дараалал чухал: эхлээд JWT (Public-ийг үл хамааруулна), дараа нь Roles,
    // сүүлд Permissions (@RequirePermission заасан route дээр л оролцоно)
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
