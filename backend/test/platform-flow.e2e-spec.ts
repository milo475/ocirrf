import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

/**
 * ПЛАТФОРМЫН БҮТЭН УРСГАЛ (Prompt 6) — туйлын чухал scenario-г НЭГ
 * тестээр эхнээс нь дуустал: бүртгэл → launcher → app дотор ажиллах →
 * хоёр дахь байгууллага юу ч харахгүй → superadmin хоёуланг нь харна.
 */

const T = Date.now().toString().slice(-7);

describe('Платформын бүтэн урсгал (integration)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let prisma: PrismaClient;

  const api = () => request(http);
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  const orgIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    http = app.getHttpServer();
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
  });

  afterAll(async () => {
    if (orgIds.length) {
      const w = { organizationId: { in: orgIds } };
      await prisma.stockMovement.deleteMany({ where: w });
      await prisma.product.deleteMany({ where: w });
      await prisma.user.deleteMany({ where: w });
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    }
    await prisma.$disconnect();
    await app.close();
  });

  it('бүртгэл → launcher → бараа → тусгаарлалт → superadmin ⭐⭐', async () => {
    // 1. Шинэ байгууллага бүртгүүлнэ
    const one = await api()
      .post('/api/auth/register-org')
      .send({
        orgName: `Урсгал-Тест-1 ${T}`,
        fullName: 'Нэг Админ',
        email: `flow-1-${T}@example.mn`,
        password: 'flow12345',
      })
      .expect(201);
    const tok1 = one.body.accessToken;
    orgIds.push(one.body.user.organizationId);

    // 2. Launcher-ийн өгөгдөл: ursgal автоматаар идэвхтэй
    const launcher1 = await api()
      .get('/api/platform/my-apps')
      .set(auth(tok1))
      .expect(200);
    expect(launcher1.body).toHaveLength(1);
    expect(launcher1.body[0].key).toBe('ursgal');

    // 3. ursgal дотор ажиллана: бараа үүсгэж, үлдэгдэл орлогодно
    const product = await api()
      .post('/api/products')
      .set(auth(tok1))
      .send({ sku: `FLOW-${T}`, name: `Урсгалын бараа ${T}`, price: '5000.00' })
      .expect(201);
    await api()
      .post('/api/stock/adjust')
      .set(auth(tok1))
      .send({ productId: product.body.id, qtyChange: 7, reason: 'PURCHASE_IN' })
      .expect(201);

    // 4. Хоёр дахь байгууллага бүртгүүлнэ — эхнийхийн ЮУ Ч харагдахгүй
    const two = await api()
      .post('/api/auth/register-org')
      .send({
        orgName: `Урсгал-Тест-2 ${T}`,
        fullName: 'Хоёр Админ',
        email: `flow-2-${T}@example.mn`,
        password: 'flow12345',
      })
      .expect(201);
    const tok2 = two.body.accessToken;
    orgIds.push(two.body.user.organizationId);

    const prods2 = await api().get('/api/products').set(auth(tok2)).expect(200);
    expect(prods2.body.items ?? prods2.body).toHaveLength(0);
    await api()
      .get(`/api/products/${product.body.id}`)
      .set(auth(tok2))
      .expect(404);
    const launcher2 = await api()
      .get('/api/platform/my-apps')
      .set(auth(tok2))
      .expect(200);
    expect(launcher2.body).toHaveLength(1); // өөрийн ursgal л байна

    // 5. Superadmin хоёуланг нь бүрэн харна
    await prisma.user.update({
      where: { username: `flow-1-${T}@example.mn` },
      data: { isSuperAdmin: true },
    });
    const orgs = await api()
      .get('/api/platform/admin/organizations')
      .set(auth(tok1))
      .expect(200);
    const names = orgs.body.map((o: { name: string }) => o.name);
    expect(names).toContain(`Урсгал-Тест-1 ${T}`);
    expect(names).toContain(`Урсгал-Тест-2 ${T}`);
    // Хоёр дахь байгууллагын мэдээлэл (1 хэрэглэгч, ursgal app) зөв
    const org2 = orgs.body.find(
      (o: { name: string }) => o.name === `Урсгал-Тест-2 ${T}`,
    );
    expect(org2.userCount).toBe(1);
    expect(org2.apps.map((a: { key: string }) => a.key)).toEqual(['ursgal']);

    // 6. Superadmin эрх нь байгууллагын тусгаарлалтыг ЭВДЭЭГҮЙ:
    // энгийн API-гаар 1-р админ 2-ын барааг мөн л харахгүй
    const prods1 = await api().get('/api/products').set(auth(tok1)).expect(200);
    const list1: Array<{ id: string }> = prods1.body.items ?? prods1.body;
    expect(list1.some((p) => p.id === product.body.id)).toBe(true);
    expect(list1).toHaveLength(1);
  });
});
