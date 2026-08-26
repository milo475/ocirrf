import type { ServerResponse } from 'node:http';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ActivityLogInterceptor } from './activity-log/activity-log.interceptor';
import { ActivityLogModule } from './activity-log/activity-log.module';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { CategoriesModule } from './categories/categories.module';
import { PrismaModule } from './prisma/prisma.module';
import { CustomersModule } from './customers/customers.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DeliveryModule } from './delivery/delivery.module';
import { FinanceModule } from './finance/finance.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrdersModule } from './orders/orders.module';
import { PermissionsGuard } from './permissions/permissions.guard';
import { PermissionsModule } from './permissions/permissions.module';
import { PortalModule } from './portal/portal.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
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
        serveStaticOptions: {
          setHeaders: (res: ServerResponse, path: string) => {
            if (path.endsWith('.html')) {
              // index.html хэзээ ч cache-лэгдэхгүй — шинэ build шууд очно
              res.setHeader('Cache-Control', 'no-store');
            } else if (path.includes('/assets/')) {
              // hash-тай asset-ууд — урт хугацааны cache
              res.setHeader(
                'Cache-Control',
                'public, max-age=31536000, immutable',
              );
            }
          },
        },
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
    NotificationsModule,
    ActivityLogModule,
    PortalModule,
    CustomersModule,
    SettingsModule,
    AnalyticsModule,
    ReportsModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [
    // Дараалал чухал: эхлээд JWT (Public-ийг үл хамааруулна), дараа нь Roles,
    // сүүлд Permissions (@RequirePermission заасан route дээр л оролцоно)
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    // Амжилттай өөрчлөлт бүрийг ActivityLog-д бичнэ
    { provide: APP_INTERCEPTOR, useClass: ActivityLogInterceptor },
  ],
})
export class AppModule {}
