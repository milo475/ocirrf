import 'dotenv/config';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

/**
 * APP REGISTRY (Prompt 1) — платформын app каталог ба байгууллага
 * бүрийн идэвхжүүлэлтийн тестүүд: нийтийн каталог, шинэ байгууллагад
 * ursgal автоматаар идэвхжих, cross-tenant тусгаарлалт.
 */

const T = Date.now().toString().slice(-7);

describe('Платформын App Registry (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let prisma: PrismaClient;

  const api = () => request(http);
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  const EMAIL_A = `app-reg-a-${T}@example.mn`;
  const EMAIL_B = `app-reg-b-${T}@example.mn`;
  let tokA = '';
  let tokB = '';
  let orgAId = '';
  let orgBId = '';
  // Тусгаарлалтыг батлахад ашиглах түр app-ууд (raw client-ээр)
  let extraAppId = '';
  let disabledAppId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    http = app.getHttpServer();
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });

    // Хоёр байгууллага бүртгэнэ
    const a = await api()
      .post('/api/auth/register-org')
      .send({
        orgName: `АппРег-А ${T}`,
        fullName: 'А Админ',
        email: EMAIL_A,
        password: 'appreg123',
      })
      .expect(201);
    tokA = a.body.accessToken;
    orgAId = a.body.user.organizationId;

    const b = await api()
      .post('/api/auth/register-org')
      .send({
        orgName: `АппРег-Б ${T}`,
        fullName: 'Б Админ',
        email: EMAIL_B,
        password: 'appreg123',
      })
      .expect(201);
    tokB = b.body.accessToken;
    orgBId = b.body.user.organizationId;

    // Тусгаарлалтын туршилтад: нэмэлт ACTIVE app-ийг үүсгээд ЗӨВХӨН
    // А-д идэвхжүүлнэ; DISABLED app каталогт харагдах ёсгүй
    const extra = await prisma.application.create({
      data: {
        key: `iso-extra-${T}`,
        nameMn: 'Туршилтын нэмэлт',
        nameEn: 'Iso Extra',
        descriptionMn: 'Тусгаарлалтын тест',
        icon: 'flask-conical',
        color: '#333333',
        status: 'ACTIVE',
        sortOrder: 90,
      },
    });
    extraAppId = extra.id;
    await prisma.organizationApp.create({
      data: { organizationId: orgAId, applicationId: extraAppId },
    });
    const disabled = await prisma.application.create({
      data: {
        key: `iso-disabled-${T}`,
        nameMn: 'Унтраасан',
        nameEn: 'Disabled',
        descriptionMn: 'Каталогт гарах ёсгүй',
        icon: 'x',
        color: '#000000',
        status: 'DISABLED',
        sortOrder: 91,
      },
    });
    disabledAppId = disabled.id;
  });

  afterAll(async () => {
    const orgIds = [orgAId, orgBId].filter(Boolean);
    // OrganizationApp нь org устахад Cascade-аар устана
    if (orgIds.length) {
      await prisma.user.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    }
    await prisma.application.deleteMany({
      where: { id: { in: [extraAppId, disabledAppId].filter(Boolean) } },
    });
    await prisma.$disconnect();
    await app.close();
  });

  describe('GET /api/platform/apps — нийтийн каталог', () => {
    it('нэвтрэлтгүй ажиллаж, ACTIVE + COMING_SOON-ийг эрэмбээр буцаана ⭐', async () => {
      const res = await api().get('/api/platform/apps').expect(200);
      const keys = res.body.map((a: { key: string }) => a.key);

      // ursgal — ACTIVE, хамгийн эхэнд
      expect(res.body[0]).toMatchObject({ key: 'ursgal', status: 'ACTIVE' });
      // COMING_SOON placeholder-ууд каталогт байна
      for (const k of ['sankhuu', 'hr', 'crm', 'hudaldan-avalt', 'tailan']) {
        expect(keys).toContain(k);
      }
      // sortOrder өсөхөөр эрэмбэлэгдсэн
      const orders = res.body.map((a: { sortOrder: number }) => a.sortOrder);
      expect([...orders].sort((x, y) => x - y)).toEqual(orders);
      // Card-д хэрэгтэй талбарууд бүрэн
      expect(res.body[0]).toHaveProperty('nameMn');
      expect(res.body[0]).toHaveProperty('descriptionMn');
      expect(res.body[0]).toHaveProperty('icon');
      expect(res.body[0]).toHaveProperty('color');
    });

    it('DISABLED app каталогт харагдахгүй', async () => {
      const res = await api().get('/api/platform/apps').expect(200);
      expect(
        res.body.some((a: { key: string }) => a.key === `iso-disabled-${T}`),
      ).toBe(false);
    });
  });

  describe('Нийтийн landing SPA (Prompt 2)', () => {
    // ServeStatic нь Test.createTestingModule дотор route-оо бүртгэдэггүй
    // тул ЭНЭ блок NestFactory-ээр тусдаа app асаана. Frontend build
    // байхгүй орчинд (CI) алгасна.
    const hasDist = existsSync(
      join(__dirname, '..', '..', 'frontend', 'dist', 'index.html'),
    );
    const maybe = hasDist ? it : it.skip;
    let spaApp: INestApplication | null = null;

    beforeAll(async () => {
      if (!hasDist) return;
      spaApp = await NestFactory.create(AppModule, { logger: false });
      spaApp.setGlobalPrefix('api');
      await spaApp.init();
    });

    afterAll(async () => {
      await spaApp?.close();
    });

    maybe('/ нэвтрэлтгүй SPA буцаана (landing)', async () => {
      const res = await request(spaApp!.getHttpServer()).get('/').expect(200);
      expect(res.headers['content-type']).toContain('text/html');
    });

    maybe('/apps/ursgal SPA fallback-аар нээгдэнэ (app detail)', async () => {
      const res = await request(spaApp!.getHttpServer())
        .get('/apps/ursgal')
        .expect(200);
      expect(res.headers['content-type']).toContain('text/html');
    });

    maybe('/launcher SPA fallback-аар нээгдэнэ (Prompt 3)', async () => {
      const res = await request(spaApp!.getHttpServer())
        .get('/launcher')
        .expect(200);
      expect(res.headers['content-type']).toContain('text/html');
    });
  });

  describe('GET /api/platform/my-apps — байгууллагын app-ууд', () => {
    it('нэвтрэлт шаардана (401)', async () => {
      await api().get('/api/platform/my-apps').expect(401);
    });

    it('шинэ бүртгүүлсэн байгууллагад ursgal автоматаар идэвхтэй ⭐', async () => {
      const res = await api()
        .get('/api/platform/my-apps')
        .set(auth(tokB))
        .expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].key).toBe('ursgal');
      expect(res.body[0].enabledAt).toBeTruthy();
    });

    it('өөр байгууллагын идэвхжүүлэлт харагдахгүй (cross-tenant) ⭐', async () => {
      // А-д нэмэлт app идэвхжүүлсэн → 2 app
      const a = await api()
        .get('/api/platform/my-apps')
        .set(auth(tokA))
        .expect(200);
      expect(a.body.map((x: { key: string }) => x.key).sort()).toEqual(
        [`iso-extra-${T}`, 'ursgal'].sort(),
      );
      // Б-д А-гийн нэмэлт app ОГТ харагдахгүй — ursgal л байна
      const b = await api()
        .get('/api/platform/my-apps')
        .set(auth(tokB))
        .expect(200);
      expect(b.body).toHaveLength(1);
      expect(
        b.body.some((x: { key: string }) => x.key === `iso-extra-${T}`),
      ).toBe(false);
    });
  });
});
