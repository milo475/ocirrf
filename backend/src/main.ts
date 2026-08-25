import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // uploads хавтас байхгүй бол үүсгэнэ (шинэ clone дээр ServeStatic алдахгүй)
  mkdirSync(join(__dirname, '..', 'uploads'), { recursive: true });

  const app = await NestFactory.create(AppModule);

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
