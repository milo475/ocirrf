import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

/**
 * SUPERADMIN ПЛАТФОРМ КОНСОЛ (Prompt 5): энгийн ADMIN 403,
 * superadmin бүх байгууллагыг харах, түдгэлзүүлэлт нэвтрэлтийг хаах,
 * каталогийн статус солилт нийтийн каталогт шууд тусах.
 */

const T = Date.now().toString().slice(-7);

describe('SUPERADMIN платформ консол (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let prisma: PrismaClient;

  const api = () => request(http);
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  const EMAIL_SUPER = `pa-super-${T}@example.mn`;
  const EMAIL_PLAIN = `pa-plain-${T}@example.mn`;
  let tokSuper = '';
  let tokPlain = '';
  let orgSuperId = '';
  let orgPlainId = '';
  let catalogAppId = '';

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

    // Хоёр байгууллага: нэгнийх нь админыг superadmin болгоно
    const s = await api()
      .post('/api/auth/register-org')
      .send({
        orgName: `ПА-Супер ${T}`,
        fullName: 'Платформ Эзэн',
        email: EMAIL_SUPER,
        password: 'super1234',
      })
      .expect(201);
    orgSuperId = s.body.user.organizationId;
    // make-superadmin.ts скрипттэй ижил үйлдэл (raw client)
    await prisma.user.update({
      where: { username: EMAIL_SUPER },
      data: { isSuperAdmin: true },
    });
    // isSuperAdmin нь JwtStrategy-ийн DB уншилтаас ирдэг тул хуучин
    // token хүчинтэй хэвээр — дахин нэвтрэх шаардлагагүй
    tokSuper = s.body.accessToken;

    const p = await api()
      .post('/api/auth/register-org')
      .send({
        orgName: `ПА-Энгийн ${T}`,
        fullName: 'Энгийн Админ',
        email: EMAIL_PLAIN,
        password: 'plain1234',
      })
      .expect(201);
    tokPlain = p.body.accessToken;
    orgPlainId = p.body.user.organizationId;
  });

  afterAll(async () => {
    const orgIds = [orgSuperId, orgPlainId].filter(Boolean);
    if (orgIds.length) {
      await prisma.user.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    }
    if (catalogAppId) {
      await prisma.application.deleteMany({ where: { id: catalogAppId } });
    }
    await prisma.$disconnect();
    await app.close();
  });

  it('энгийн ADMIN /api/platform/admin/* руу 403 авна ⭐', async () => {
    await api()
      .get('/api/platform/admin/organizations')
      .set(auth(tokPlain))
      .expect(403);
    await api()
      .get('/api/platform/admin/stats')
      .set(auth(tokPlain))
      .expect(403);
    await api()
      .patch(`/api/platform/admin/organizations/${orgSuperId}/suspend`)
      .set(auth(tokPlain))
      .expect(403);
  });

  it('superadmin БҮХ байгууллагыг статистиктай нь харна ⭐', async () => {
    const res = await api()
      .get('/api/platform/admin/organizations')
      .set(auth(tokSuper))
      .expect(200);
    const names = res.body.map((o: { name: string }) => o.name);
    expect(names).toContain(`ПА-Супер ${T}`);
    expect(names).toContain(`ПА-Энгийн ${T}`);
    const plain = res.body.find((o: { id: string }) => o.id === orgPlainId);
    expect(plain.userCount).toBe(1);
    expect(plain.apps.some((a: { key: string }) => a.key === 'ursgal')).toBe(
      true,
    );
    expect(plain.isActive).toBe(true);

    const stats = await api()
      .get('/api/platform/admin/stats')
      .set(auth(tokSuper))
      .expect(200);
    expect(stats.body.organizations).toBeGreaterThanOrEqual(2);
    expect(stats.body.users).toBeGreaterThanOrEqual(2);
    expect(stats.body.activeApps).toBeGreaterThanOrEqual(1);
  });

  it('хайлт нэрээр шүүнэ', async () => {
    const res = await api()
      .get(`/api/platform/admin/organizations?search=ПА-Энгийн ${T}`)
      .set(auth(tokSuper))
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(orgPlainId);
  });

  it('түдгэлзүүлсэн байгууллагын хэрэглэгч нэвтэрч чадахгүй ⭐', async () => {
    await api()
      .patch(`/api/platform/admin/organizations/${orgPlainId}/suspend`)
      .set(auth(tokSuper))
      .expect(200);

    const login = await api()
      .post('/api/auth/login')
      .send({ email: EMAIL_PLAIN, password: 'plain1234' })
      .expect(403);
    expect(login.body.message).toContain('түдгэлзсэн');

    // Сэргээхэд дахин нэвтэрнэ
    await api()
      .patch(`/api/platform/admin/organizations/${orgPlainId}/activate`)
      .set(auth(tokSuper))
      .expect(200);
    await api()
      .post('/api/auth/login')
      .send({ email: EMAIL_PLAIN, password: 'plain1234' })
      .expect(200);
  });

  it('каталог: app нэмэх, COMING_SOON→ACTIVE солиход нийтийн каталогт тусна ⭐', async () => {
    // Шинэ app нэмнэ
    const created = await api()
      .post('/api/platform/admin/apps')
      .set(auth(tokSuper))
      .send({
        key: `pa-app-${T}`,
        nameMn: 'Консол тест',
        nameEn: 'Console Test',
        descriptionMn: 'SUPERADMIN каталогийн тест',
        icon: 'flask-conical',
        color: '#123456',
      })
      .expect(201);
    catalogAppId = created.body.id;
    expect(created.body.status).toBe('COMING_SOON');

    // Давхар key → 400
    await api()
      .post('/api/platform/admin/apps')
      .set(auth(tokSuper))
      .send({
        key: `pa-app-${T}`,
        nameMn: 'Давхар',
        nameEn: 'Dup',
        descriptionMn: 'давхар key',
        icon: 'x',
        color: '#000000',
      })
      .expect(400);

    // Нийтийн каталогт COMING_SOON байдлаар харагдана, идэвхжүүлж болохгүй
    const pub1 = await api().get('/api/platform/apps').expect(200);
    expect(
      pub1.body.find((a: { key: string }) => a.key === `pa-app-${T}`)?.status,
    ).toBe('COMING_SOON');
    await api()
      .post(`/api/platform/my-apps/pa-app-${T}/enable`)
      .set(auth(tokPlain))
      .expect(400);

    // ACTIVE болгомогц идэвхжүүлж болно
    await api()
      .patch(`/api/platform/admin/apps/${catalogAppId}`)
      .set(auth(tokSuper))
      .send({ status: 'ACTIVE' })
      .expect(200);
    const pub2 = await api().get('/api/platform/apps').expect(200);
    expect(
      pub2.body.find((a: { key: string }) => a.key === `pa-app-${T}`)?.status,
    ).toBe('ACTIVE');
    await api()
      .post(`/api/platform/my-apps/pa-app-${T}/enable`)
      .set(auth(tokPlain))
      .expect(201);

    // key солих оролдлого — DTO-д байхгүй тул whitelist хаяад нэр л өөрчилнө
    const renamed = await api()
      .patch(`/api/platform/admin/apps/${catalogAppId}`)
      .set(auth(tokSuper))
      .send({ key: 'huurmag-key', nameMn: 'Нэр шинэ' })
      .expect(200);
    expect(renamed.body.key).toBe(`pa-app-${T}`);
    expect(renamed.body.nameMn).toBe('Нэр шинэ');
  });
});
