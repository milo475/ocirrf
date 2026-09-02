import 'dotenv/config';
import { deflateSync } from 'node:zlib';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

/**
 * БАЙГУУЛЛАГЫН ТУСГААРЛАЛТЫН НОТОЛГОО (Multi-tenancy, Step 4).
 *
 * Хоёр байгууллага (A, B) /auth/register-org-оор өөрсдөө бүртгүүлж,
 * бие биенийхээ өгөгдөлд ХААНААС Ч хүрч чадахгүйг батална: бараа,
 * захиалга, тохиргоо, нийтийн линк, төлбөрийн баримт, хэрэглэгчид.
 * Cleanup нь raw client-ээр (org-scope extension-гүй).
 */

const T = Date.now().toString().slice(-7);

/** api-v2 спектэй ижил — хамгийн жижиг хүчинтэй PNG (баримтын зурагт) */
function makePng(): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const t = Buffer.from(type);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([t, data]);
    const crcTable: number[] = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable.push(c >>> 0);
    }
    let crc = 0xffffffff;
    for (const b of body) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([len, body, crcBuf]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(8, 0);
  ihdr.writeUInt32BE(8, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(24, 0x40)]);
  const raw = Buffer.concat(Array.from({ length: 8 }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const PNG = makePng();

const UB_ADDR = {
  region: 'ULAANBAATAR',
  district: 'ХУД',
  khoroo: '11',
  building: 'Тусгаарлалт тест байр',
  entrance: '1',
  floor: '2',
  door: '21',
};

describe('Байгууллагын тусгаарлалт (multi-tenancy e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let prisma: PrismaClient;

  const api = () => request(http);
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  const EMAIL_A = `iso-a-${T}@example.mn`;
  const EMAIL_B = `iso-b-${T}@example.mn`;
  let tokA = '';
  let tokB = '';
  let orgAId = '';
  let orgBId = '';

  // Тестийн явцад үүссэн зүйлс
  const SKU = `ISO-${T}`;
  let productAId = '';
  let productBId = '';
  let orderAId = '';
  let publicTokenA = '';
  let publicTokenB = '';
  let requestAId = '';
  let proofUrlA = '';

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
  });

  afterAll(async () => {
    // FK дарааллаар цэвэрлэнэ; User устгал token/түүх/permission-оо
    // Cascade-аар, Organization устгал Setting-ээ Cascade-аар авч явна.
    const orgIds = [orgAId, orgBId].filter(Boolean);
    if (orgIds.length) {
      const w = { organizationId: { in: orgIds } };
      await prisma.stockMovement.deleteMany({ where: w });
      await prisma.productBatch.deleteMany({ where: w });
      await prisma.financeEntry.deleteMany({ where: w });
      await prisma.payment.deleteMany({ where: w });
      await prisma.orderReturn.deleteMany({ where: w });
      await prisma.order.deleteMany({ where: w });
      await prisma.orderRequest.deleteMany({ where: w });
      await prisma.supply.deleteMany({ where: w });
      await prisma.driverHandover.deleteMany({ where: w });
      await prisma.driverPayout.deleteMany({ where: w });
      await prisma.product.deleteMany({ where: w });
      await prisma.category.deleteMany({ where: w });
      await prisma.company.deleteMany({ where: w });
      await prisma.activityLog.deleteMany({ where: w });
      await prisma.user.deleteMany({ where: w });
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    }
    await prisma.$disconnect();
    await app.close();
  });

  // ──────────────────────────────────────── Бүртгэл (register-org)
  describe('Байгууллагын нээлттэй бүртгэл', () => {
    it('А байгууллага бүртгүүлж ADMIN эрхтэй шууд нэвтэрнэ ⭐', async () => {
      const res = await api()
        .post('/api/auth/register-org')
        .send({
          orgName: `Тусгаарлалт-А ${T}`,
          fullName: 'А Админ',
          email: EMAIL_A,
          password: 'isolate123',
        })
        .expect(201);
      expect(res.body.accessToken).toBeTruthy();
      expect(res.body.user.role).toBe('ADMIN');
      expect(res.body.user.organizationName).toBe(`Тусгаарлалт-А ${T}`);
      expect(res.body.user.permissions).toContain('orders.create');
      tokA = res.body.accessToken;
      orgAId = res.body.user.organizationId;
    });

    it('Б байгууллага мөн бүртгүүлнэ — хоосон эхэлнэ', async () => {
      const res = await api()
        .post('/api/auth/register-org')
        .send({
          orgName: `Тусгаарлалт-Б ${T}`,
          fullName: 'Б Админ',
          email: EMAIL_B,
          password: 'isolate123',
          phone: '99110022',
        })
        .expect(201);
      tokB = res.body.accessToken;
      orgBId = res.body.user.organizationId;
      expect(orgBId).not.toBe(orgAId);

      // Шинэ байгууллага ХООСОН: бараа, захиалга, хэрэглэгч нэг л админ
      const [prods, orders, users] = await Promise.all([
        api().get('/api/products').set(auth(tokB)).expect(200),
        api().get('/api/orders').set(auth(tokB)).expect(200),
        api().get('/api/users').set(auth(tokB)).expect(200),
      ]);
      expect(prods.body.items ?? prods.body).toHaveLength(0);
      expect(orders.body.items).toHaveLength(0);
      expect(users.body).toHaveLength(1);
      expect(users.body[0].username).toBe(EMAIL_B);
    });

    it('давхар имэйл → 409, сул нууц үг → 400', async () => {
      await api()
        .post('/api/auth/register-org')
        .send({
          orgName: 'Давхар',
          fullName: 'Хэн нэгэн',
          email: EMAIL_A,
          password: 'isolate123',
        })
        .expect(409);
      await api()
        .post('/api/auth/register-org')
        .send({
          orgName: 'Сул',
          fullName: 'Хэн нэгэн',
          email: `iso-weak-${T}@example.mn`,
          password: '123',
        })
        .expect(400);
    });
  });

  // ──────────────────────────────────────── Өгөгдлийн тусгаарлалт
  describe('Бараа, захиалгын тусгаарлалт ⭐', () => {
    it('А бараа+захиалга үүсгэнэ; Б-гийн жагсаалтад огт харагдахгүй', async () => {
      const p = await api()
        .post('/api/products')
        .set(auth(tokA))
        .send({ sku: SKU, name: `Тусгаарлалт бараа ${T}`, price: '9900.00' })
        .expect(201);
      productAId = p.body.id;
      await api()
        .post('/api/stock/adjust')
        .set(auth(tokA))
        .send({ productId: productAId, qtyChange: 10, reason: 'PURCHASE_IN' })
        .expect(201);
      const o = await api()
        .post('/api/orders')
        .set(auth(tokA))
        .send({
          customerName: `Тусгаарлалт-Хэрэглэгч`,
          customerPhone: `8${T}`,
          ...UB_ADDR,
          items: [{ productId: productAId, qty: 2 }],
        })
        .expect(201);
      orderAId = o.body.id;

      const prodsB = await api().get('/api/products').set(auth(tokB)).expect(200);
      const listB: Array<{ id: string }> = prodsB.body.items ?? prodsB.body;
      expect(listB.some((x) => x.id === productAId)).toBe(false);

      const ordersB = await api().get('/api/orders').set(auth(tokB)).expect(200);
      expect(
        ordersB.body.items.some((x: { id: string }) => x.id === orderAId),
      ).toBe(false);
    });

    it('Б нь А-гийн бараа/захиалгыг id-гээр ч авахгүй (404) ⭐', async () => {
      await api().get(`/api/products/${productAId}`).set(auth(tokB)).expect(404);
      await api().get(`/api/orders/${orderAId}`).set(auth(tokB)).expect(404);
      // Өөрчлөх оролдлого ч 404 — байдаг эсэхийг нь ч мэдэхгүй
      await api()
        .patch(`/api/orders/${orderAId}/status`)
        .set(auth(tokB))
        .send({ status: 'CONFIRMED' })
        .expect(404);
      // А өөрөө хэвийн харна
      await api().get(`/api/orders/${orderAId}`).set(auth(tokA)).expect(200);
    });

    it('ижил SKU хоёр байгууллагад зэрэг оршино (composite unique) ⭐', async () => {
      const p = await api()
        .post('/api/products')
        .set(auth(tokB))
        .send({ sku: SKU, name: `Б-гийн ижил SKU ${T}`, price: '100.00' })
        .expect(201);
      productBId = p.body.id;
      // Харин НЭГ байгууллага дотроо давхардвал 409 хэвээр
      await api()
        .post('/api/products')
        .set(auth(tokB))
        .send({ sku: SKU, name: 'Давхар', price: '1.00' })
        .expect(409);
    });

    it('захиалгын дугаар байгууллага бүрт 0001-ээс эхэлнэ ⭐', async () => {
      await api()
        .post('/api/stock/adjust')
        .set(auth(tokB))
        .send({ productId: productBId, qtyChange: 5, reason: 'PURCHASE_IN' })
        .expect(201);
      const o = await api()
        .post('/api/orders')
        .set(auth(tokB))
        .send({
          customerPhone: `7${T}`,
          ...UB_ADDR,
          items: [{ productId: productBId, qty: 1 }],
        })
        .expect(201);
      // А-гийн эхний захиалга -0001 байсан; Б-гийнх ч мөн -0001:
      // дараалал глобал биш байгууллага доторх гэдгийн нотолгоо
      const oA = await api().get(`/api/orders/${orderAId}`).set(auth(tokA));
      expect(oA.body.orderNo.endsWith('-0001')).toBe(true);
      expect(o.body.orderNo.endsWith('-0001')).toBe(true);
    });
  });

  describe('Тохиргооны тусгаарлалт', () => {
    it('А companyName-ээ сольход Б-гийнх өөрчлөгдөхгүй ⭐', async () => {
      await api()
        .put('/api/settings')
        .set(auth(tokA))
        .send({ companyName: `А-Шинэ-Нэр-${T}` })
        .expect(200);
      const b = await api().get('/api/settings').set(auth(tokB)).expect(200);
      expect(b.body.companyName).toBe(`Тусгаарлалт-Б ${T}`);
      const a = await api().get('/api/settings').set(auth(tokA)).expect(200);
      expect(a.body.companyName).toBe(`А-Шинэ-Нэр-${T}`);
    });
  });

  describe('Нийтийн захиалгын линкийн тусгаарлалт ⭐', () => {
    it('token бүр өөрийн байгууллагын барааг л буцаана', async () => {
      const [lA, lB] = await Promise.all([
        api().get('/api/order-requests/link').set(auth(tokA)).expect(200),
        api().get('/api/order-requests/link').set(auth(tokB)).expect(200),
      ]);
      publicTokenA = lA.body.token;
      publicTokenB = lB.body.token;
      expect(publicTokenA).not.toBe(publicTokenB);

      const formA = await api()
        .get(`/api/public/order-form?token=${publicTokenA}`)
        .expect(200);
      expect(
        formA.body.products.some((p: { id: string }) => p.id === productAId),
      ).toBe(true);
      expect(
        formA.body.products.some((p: { id: string }) => p.id === productBId),
      ).toBe(false);
      // Компанийн нэр нь тухайн байгууллагынх
      expect(formA.body.companyName).toBe(`А-Шинэ-Нэр-${T}`);

      const formB = await api()
        .get(`/api/public/order-form?token=${publicTokenB}`)
        .expect(200);
      expect(
        formB.body.products.some((p: { id: string }) => p.id === productAId),
      ).toBe(false);

      await api().get('/api/public/order-form?token=buruu-token').expect(404);
    });

    it('линкээр ирсэн хүсэлт зөвхөн ЭЗЭН байгууллагад нь очно ⭐', async () => {
      const res = await api()
        .post(`/api/public/order-requests?token=${publicTokenA}`)
        .field('customerName', `Тусгаарлалт Хүсэлт ${T}`)
        .field('phone', `9${T}`)
        .field('channel', 'INSTAGRAM')
        .field('region', 'ULAANBAATAR')
        .field('district', 'ХУД')
        .field('khoroo', '11')
        .field('building', 'Тест байр')
        .attach('proof', PNG, { filename: 'proof.png', contentType: 'image/png' })
        .field('items', JSON.stringify([{ productId: productAId, qty: 1 }]))
        .expect(201);
      requestAId = res.body.id;

      const listA = await api()
        .get('/api/order-requests')
        .set(auth(tokA))
        .expect(200);
      const mineA = listA.body.find((r: { id: string }) => r.id === requestAId);
      expect(mineA).toBeTruthy();
      proofUrlA = mineA.paymentProofUrl;

      const listB = await api()
        .get('/api/order-requests')
        .set(auth(tokB))
        .expect(200);
      expect(listB.body.some((r: { id: string }) => r.id === requestAId)).toBe(
        false,
      );
    });

    it('төлбөрийн баримтын зураг өөр байгууллагад нээгдэхгүй ⭐', async () => {
      expect(proofUrlA).toBeTruthy();
      await api().get(proofUrlA).set(auth(tokA)).expect(200);
      // Б-гийн админ нэвтэрсэн ч А-гийн баримтыг үзэж чадахгүй
      const denied = await api().get(proofUrlA).set(auth(tokB));
      expect([403, 404]).toContain(denied.status);
      // Нэвтрээгүй хүнд огт нээлттэй биш
      await api().get(proofUrlA).expect(401);
    });
  });

  describe('Хэрэглэгчийн тусгаарлалт', () => {
    it('users жагсаалт өөрийн байгууллагаар хязгаарлагдана', async () => {
      const usersA = await api().get('/api/users').set(auth(tokA)).expect(200);
      expect(
        usersA.body.some((u: { username: string }) => u.username === EMAIL_B),
      ).toBe(false);
      // Ерөнхий системийн (default org) хэрэглэгчид ч харагдахгүй
      expect(
        usersA.body.some(
          (u: { username: string }) => u.username === 'admin@ocirrf.mn',
        ),
      ).toBe(false);
    });

    it('өөр байгууллагын хэрэглэгчийг засаж чадахгүй (404)', async () => {
      const usersB = await api().get('/api/users').set(auth(tokB)).expect(200);
      const bAdminId = usersB.body[0].id;
      await api()
        .patch(`/api/users/${bAdminId}`)
        .set(auth(tokA))
        .send({ name: 'Хакердсан нэр' })
        .expect(404);
    });
  });
});
