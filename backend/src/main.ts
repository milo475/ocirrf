import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { UPLOADS_DIR } from './uploads.config';

async function bootstrap() {
  // uploads хавтас байхгүй бол үүсгэнэ (шинэ clone/production дээр ServeStatic алдахгүй)
  mkdirSync(UPLOADS_DIR, { recursive: true });

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  /**
   * REVERSE PROXY (nginx, Caddy, load balancer) ард ажиллах үед.
   * Тохируулаагүй бол req.ip нь proxy-гийн IP болж: rate limit бүх
   * хэрэглэгчид нэг тоолуураар тоологдож (нэг хүн бүгдийг түгжинэ),
   * нэвтрэлтийн түүх/аюулгүй байдлын лог proxy-гийн IP бичнэ.
   * TRUST_PROXY="1" (hop-ийн тоо), "loopback", эсвэл IP/CIDR — Express-ийн
   * 'trust proxy' утга. Шууд интернэтэд байвал ТОХИРУУЛАХГҮЙ (spoof).
   */
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy) {
    app.set(
      'trust proxy',
      /^\d+$/.test(trustProxy) ? parseInt(trustProxy, 10) : trustProxy,
    );
  }

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.enableCors({
    // Dev үед Vite (5173); production-д нэг порт тул CORS бараг хэрэггүй ч
    // тусдаа домэйнд байршуулбал CORS_ORIGIN-оор тохируулна
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
