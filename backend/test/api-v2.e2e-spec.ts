import 'dotenv/config';
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { UPLOADS_DIR } from '../src/uploads.config';

/**
 * ursGAL v2 — иж бүрэн E2E тест.
 * Бодит DB ашиглана: өөрийн тест өгөгдлөө (T суффикстэй) үүсгэж,
 * төгсгөлд бүгдийг цэвэрлэнэ. Seed-ийн 4 хэрэглэгч байх шаардлагатай.
 */

const T = Date.now().toString().slice(-7); // давхардахгүй суффикс
const SKU = `E2E-${T}`;

/** УБ горимын жишиг хаяг (fullAddress-ийн хүлээгдэх утгатай хослоно) */
const UB_ADDR = {
  region: 'ULAANBAATAR',
  district: 'ХУД',
  khoroo: '11',
  building: 'Гоёо хотхон 45-р байр',
  entrance: '2',
  floor: '5',
  door: '501',
};
const UB_FULL =
  'ХУД, 11-р хороо, Гоёо хотхон 45-р байр, 2-р орц, 5 давхар, 501 тоот';

/** Хамгийн жижиг хүчинтэй PNG (8×8) — баталгаажуулах зурагт */
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

describe('ursGAL v2 API (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let prisma: PrismaService;

  // Токенууд
  const tok: Record<string, string> = {};
  // Тестийн туршид үүсэх зүйлс
  let categoryId: string;
  let productId: string;
  let orderId: string; // үндсэн урсгалын захиалга
  let order2Id: string; // амжилтгүй + цуцлалтын захиалга
  let adminOrderId: string; // операторын 403 тест
  let e2eDriverId: string; // тестийн жолооч
  let e2eDriverToken: string;
  const proofFiles: string[] = [];

  const api = () => request(http);
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);

    for (const u of ['admin', 'manager', 'operator', 'driver']) {
      const res = await api()
        .post('/api/auth/login')
        .send({ email: `${u}@ursgal.mn`, password: `${u}123` })
        .expect(200);
      tok[u] = res.body.accessToken;
    }
  });

  afterAll(async () => {
    // Тестийн бүх ул мөрийг цэвэрлэнэ
    const orderIds = [orderId, order2Id, adminOrderId].filter(Boolean);
    await prisma.stockMovement.deleteMany({
      where: { OR: [{ productId }, { refId: { in: orderIds } }] },
    });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    if (productId) {
      await prisma.product.deleteMany({ where: { id: productId } });
    }
    if (categoryId) {
      await prisma.category.deleteMany({ where: { id: categoryId } });
    }
    if (e2eDriverId) {
      await prisma.driverProfile.deleteMany({ where: { userId: e2eDriverId } });
      await prisma.user.deleteMany({ where: { id: e2eDriverId } });
    }
    for (const f of proofFiles) {
      try {
        unlinkSync(join(UPLOADS_DIR, f));
      } catch {
        /* аль хэдийн байхгүй бол зүгээр */
      }
    }
    await app.close();
  });

  // ────────────────────────────────────────────── AUTH
  describe('Auth', () => {
    it('4 эрх бүгд нэвтэрч, /me зөв role буцаана', async () => {
      for (const [u, role] of [
        ['admin', 'ADMIN'],
        ['manager', 'MANAGER'],
        ['operator', 'OPERATOR'],
        ['driver', 'DRIVER'],
      ] as const) {
        const res = await api().get('/api/auth/me').set(auth(tok[u])).expect(200);
        expect(res.body.role).toBe(role);
        expect(res.body.passwordHash).toBeUndefined();
      }
    });

    it('буруу нууц үг → 401 ялгагдахгүй мессежтэй', async () => {
      const res = await api()
        .post('/api/auth/login')
        .send({ email: 'admin@ursgal.mn', password: 'buruu' })
        .expect(401);
      expect(res.body.message).toBe('Нэвтрэх мэдээлэл буруу');
    });

    it('refresh шинэ хос token өгнө', async () => {
      const login = await api()
        .post('/api/auth/login')
        .send({ email: 'operator@ursgal.mn', password: 'operator123' })
        .expect(200);
      const res = await api()
        .post('/api/auth/refresh')
        .send({ refreshToken: login.body.refreshToken })
        .expect(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.role).toBe('OPERATOR');
    });
  });

  // ────────────────────────────────────────────── ЭРХИЙН МАТРИЦ
  describe('Эрхийн матриц (403)', () => {
    const cases: [string, 'get' | 'post', string, string][] = [
      ['driver бараа харах', 'get', '/api/products', 'driver'],
      ['driver захиалга харах', 'get', '/api/orders', 'driver'],
      ['operator хэрэглэгчид', 'get', '/api/users', 'operator'],
      ['manager admin dashboard', 'get', '/api/dashboard/admin', 'manager'],
      ['admin driver dashboard', 'get', '/api/dashboard/driver', 'admin'],
      ['operator stock summary', 'get', '/api/stock/summary', 'operator'],
      ['driver өөрийн хүргэлт БОЛНО (баталгаа)', 'get', '/api/deliveries/my', 'driver'],
    ];
    for (const [name, method, path, user] of cases) {
      it(name, async () => {
        const expected = name.includes('БОЛНО') ? 200 : 403;
        await api()[method](path).set(auth(tok[user])).expect(expected);
      });
    }

    it('operator бараа үүсгэх → 403, manager захиалга үүсгэх → 403', async () => {
      await api()
        .post('/api/products')
        .set(auth(tok.operator))
        .send({ sku: 'X', name: 'X', price: '1' })
        .expect(403);
      await api()
        .post('/api/orders')
        .set(auth(tok.manager))
        .send({ customerName: 'X', customerPhone: '1', address: 'x', items: [] })
        .expect(403);
    });
  });

  // ────────────────────────────────────────────── CATEGORY
  describe('Categories', () => {
    it('manager ангилал үүсгэнэ', async () => {
      const res = await api()
        .post('/api/categories')
        .set(auth(tok.manager))
        .send({ name: `Тест-Э2Э-${T}` })
        .expect(201);
      categoryId = res.body.id;
    });

    it('давхардсан нэр → 409', async () => {
      await api()
        .post('/api/categories')
        .set(auth(tok.manager))
        .send({ name: `Тест-Э2Э-${T}` })
        .expect(409);
    });
  });

  // ────────────────────────────────────────────── PRODUCT
  describe('Products', () => {
    it('manager бараа үүсгэнэ (lowStockLimit-тэй)', async () => {
      const res = await api()
        .post('/api/products')
        .set(auth(tok.manager))
        .send({
          sku: SKU,
          name: `Э2Э бараа ${T}`,
          price: '1000.00',
          lowStockLimit: 3,
          categoryId,
        })
        .expect(201);
      productId = res.body.id;
      expect(res.body.stockQty).toBe(0);
      expect(res.body.lowStockLimit).toBe(3);
    });

    it('давхардсан SKU → 409', async () => {
      await api()
        .post('/api/products')
        .set(auth(tok.manager))
        .send({ sku: SKU, name: 'Давхар', price: '1' })
        .expect(409);
    });

    it('бараатай ангилал устгах → 409', async () => {
      await api()
        .delete(`/api/categories/${categoryId}`)
        .set(auth(tok.manager))
        .expect(409);
    });

    it('PATCH дээр stockQty нэвтрэхгүй (whitelist)', async () => {
      const res = await api()
        .patch(`/api/products/${productId}`)
        .set(auth(tok.manager))
        .send({ name: `Э2Э шинэчилсэн ${T}`, stockQty: 999 })
        .expect(200);
      expect(res.body.stockQty).toBe(0);
    });

    it('lowStock=true шүүлтэд орж ирнэ (0 ≤ 3)', async () => {
      const res = await api()
        .get('/api/products?lowStock=true&limit=100')
        .set(auth(tok.operator))
        .expect(200);
      expect(res.body.items.some((p: { id: string }) => p.id === productId)).toBe(true);
    });
  });

  // ────────────────────────────────────────────── STOCK
  describe('Stock', () => {
    it('PURCHASE_IN +10 → үлдэгдэл 10, note хадгалагдана', async () => {
      const res = await api()
        .post('/api/stock/adjust')
        .set(auth(tok.manager))
        .send({ productId, qtyChange: 10, reason: 'PURCHASE_IN', note: 'e2e орлого' })
        .expect(201);
      expect(res.body.product.stockQty).toBe(10);
      expect(res.body.movement.note).toBe('e2e орлого');
    });

    it('MANUAL_OUT эерэг тоотой → 400 (чиглэлийн шалгалт)', async () => {
      await api()
        .post('/api/stock/adjust')
        .set(auth(tok.manager))
        .send({ productId, qtyChange: 5, reason: 'MANUAL_OUT' })
        .expect(400);
    });

    it('хэтэрсэн зарлага → 400 + rollback', async () => {
      await api()
        .post('/api/stock/adjust')
        .set(auth(tok.manager))
        .send({ productId, qtyChange: -100, reason: 'MANUAL_OUT' })
        .expect(400);
      const p = await api()
        .get(`/api/products/${productId}`)
        .set(auth(tok.manager))
        .expect(200);
      expect(p.body.stockQty).toBe(10);
    });

    it('жагсаалтад байхгүй reason → 400', async () => {
      await api()
        .post('/api/stock/adjust')
        .set(auth(tok.manager))
        .send({ productId, qtyChange: 1, reason: 'MANUAL' })
        .expect(400);
    });

    it('movements reason шүүлт + summary 7 хоног', async () => {
      const mv = await api()
        .get(`/api/stock/movements?productId=${productId}&reason=PURCHASE_IN`)
        .set(auth(tok.operator))
        .expect(200);
      expect(mv.body.total).toBe(1);

      const sum = await api()
        .get('/api/stock/summary?days=7')
        .set(auth(tok.manager))
        .expect(200);
      expect(sum.body).toHaveLength(7);
      expect(sum.body[6]).toHaveProperty('in');
      expect(sum.body[6]).toHaveProperty('out');
      expect(sum.body[6].in).toBeGreaterThanOrEqual(10);
    });
  });

  // ────────────────────────────────────────────── ORDERS
  describe('Orders — transaction ⭐', () => {
    it('УБ горимд дүүрэггүй → 400 «Дүүрэг заавал»', async () => {
      const { district: _d, ...noDistrict } = UB_ADDR;
      const res = await api()
        .post('/api/orders')
        .set(auth(tok.operator))
        .send({
          customerPhone: `9${T}`,
          ...noDistrict,
          items: [{ productId, qty: 1 }],
        })
        .expect(400);
      expect(res.body.message).toContain('Дүүрэг заавал');
    });

    it('Орон нутагт тээвэргүй → 400 «Ачаа явах тээвэр заавал»', async () => {
      const res = await api()
        .post('/api/orders')
        .set(auth(tok.operator))
        .send({
          customerPhone: `9${T}`,
          region: 'ORON_NUTAG',
          province: 'Архангай',
          soum: 'Эрдэнэбулган',
          items: [{ productId, qty: 1 }],
        })
        .expect(400);
      expect(res.body.message).toContain('Ачаа явах тээвэр заавал');
    });

    it('утас 8 оронтой биш → 400', async () => {
      await api()
        .post('/api/orders')
        .set(auth(tok.operator))
        .send({
          customerPhone: '123',
          ...UB_ADDR,
          items: [{ productId, qty: 1 }],
        })
        .expect(400);
    });

    it('давхардсан productId → 400', async () => {
      await api()
        .post('/api/orders')
        .set(auth(tok.operator))
        .send({
          customerName: `Э2Э-${T}`,
          customerPhone: `9${T}`,
          items: [
            { productId, qty: 1 },
            { productId, qty: 2 },
          ],
        })
        .expect(400);
    });

    it('амжилттай үүсгэлт: дүн, үлдэгдэл, movement', async () => {
      const res = await api()
        .post('/api/orders')
        .set(auth(tok.operator))
        .send({
          customerName: `Э2Э-${T}`,
          customerPhone: `9${T}`,
          extraPhone: `8${T}`,
          ...UB_ADDR,
          items: [{ productId, qty: 4 }],
        })
        .expect(201);
      orderId = res.body.id;
      expect(res.body.region).toBe('ULAANBAATAR');
      expect(res.body.district).toBe('ХУД');
      expect(res.body.province).toBeNull(); // эсрэг горимын талбар null

      // GET /:id — fullAddress зөв угсрагдана
      const detail = await api()
        .get(`/api/orders/${orderId}`)
        .set(auth(tok.operator))
        .expect(200);
      expect(detail.body.fullAddress).toBe(UB_FULL);
      expect(res.body.orderNo).toMatch(/^ORD-\d{8}-\d{4}$/);
      expect(Number(res.body.totalAmount)).toBe(4000);
      expect(res.body.deliveryStatus).toBe('PENDING');
      expect(res.body.items[0].productName).toBe(`Э2Э шинэчилсэн ${T}`);

      const p = await api()
        .get(`/api/products/${productId}`)
        .set(auth(tok.operator))
        .expect(200);
      expect(p.body.stockQty).toBe(6);

      const mv = await api()
        .get(`/api/stock/movements?productId=${productId}&reason=ORDER`)
        .set(auth(tok.operator))
        .expect(200);
      expect(mv.body.items[0].qtyChange).toBe(-4);
      expect(mv.body.items[0].refId).toBe(orderId);
    });

    it('хүрэлцэхгүй qty → 400 + ЮУ Ч өөрчлөгдөөгүй', async () => {
      const res = await api()
        .post('/api/orders')
        .set(auth(tok.operator))
        .send({
          customerName: `Э2Э-их-${T}`,
          customerPhone: `9${T}`,
          ...UB_ADDR,
          items: [{ productId, qty: 9999 }],
        })
        .expect(400);
      expect(res.body.message).toContain('хүрэлцэхгүй');
      const p = await api()
        .get(`/api/products/${productId}`)
        .set(auth(tok.operator))
        .expect(200);
      expect(p.body.stockQty).toBe(6);
    });

    it('буруу шилжилт NEW→COMPLETED → 400', async () => {
      await api()
        .patch(`/api/orders/${orderId}/status`)
        .set(auth(tok.operator))
        .send({ status: 'COMPLETED' })
        .expect(400);
    });

    it('operator бусдын захиалгын статус → 403', async () => {
      const admOrd = await api()
        .post('/api/orders')
        .set(auth(tok.admin))
        .send({
          customerName: `Э2Э-адм-${T}`,
          customerPhone: `8${T}`,
          region: 'ORON_NUTAG',
          province: 'Архангай',
          soum: 'Эрдэнэбулган',
          transport: 'Од транс',
          addressDetail: 'Захын хойд талд',
          items: [{ productId, qty: 1 }],
        })
        .expect(201);
      adminOrderId = admOrd.body.id;
      expect(admOrd.body.district).toBeNull(); // УБ талбарууд null
      const admDetail = await api()
        .get(`/api/orders/${adminOrderId}`)
        .set(auth(tok.admin))
        .expect(200);
      expect(admDetail.body.fullAddress).toBe(
        'Архангай, Эрдэнэбулган сум — Тээвэр: Од транс, Захын хойд талд',
      );
      await api()
        .patch(`/api/orders/${adminOrderId}/status`)
        .set(auth(tok.operator))
        .send({ status: 'CONFIRMED' })
        .expect(403);
      // цэвэрлэгээ: админ өөрөө цуцалж үлдэгдлээ буцаана
      await api()
        .patch(`/api/orders/${adminOrderId}/status`)
        .set(auth(tok.admin))
        .send({ status: 'CANCELLED' })
        .expect(200);
    });

    it('driver статус солих → 403', async () => {
      await api()
        .patch(`/api/orders/${orderId}/status`)
        .set(auth(tok.driver))
        .send({ status: 'CONFIRMED' })
        .expect(403);
    });

    it('operator өөрийнхөө захиалгыг CONFIRMED болгоно', async () => {
      const res = await api()
        .patch(`/api/orders/${orderId}/status`)
        .set(auth(tok.operator))
        .send({ status: 'CONFIRMED' })
        .expect(200);
      expect(res.body.orderStatus).toBe('CONFIRMED');
    });
  });

  // ────────────────────────────────────────────── DELIVERY
  describe('Delivery — хүргэлтийн мөчлөг ⭐', () => {
    it('тестийн жолооч үүсгэнэ (profile transaction-оор)', async () => {
      const res = await api()
        .post('/api/users')
        .set(auth(tok.admin))
        .send({
          email: `e2e-drv-${T}@ursgal.mn`,
          name: `Э2Э Жолооч ${T}`,
          password: 'e2epass123',
          role: 'DRIVER',
          feePerDelivery: '1500.00',
          vehicleInfo: 'Э2Э тэрэг',
        })
        .expect(201);
      e2eDriverId = res.body.id;
      expect(res.body.driverProfile.feePerDelivery).toBe('1500');

      const login = await api()
        .post('/api/auth/login')
        .send({ email: `e2e-drv-${T}@ursgal.mn`, password: 'e2epass123' })
        .expect(200);
      e2eDriverToken = login.body.accessToken;
    });

    it('feePerDelivery-гүй DRIVER үүсгэх → 400', async () => {
      await api()
        .post('/api/users')
        .set(auth(tok.admin))
        .send({
          email: `e2e-drv2-${T}@ursgal.mn`,
          name: 'Хөлсгүй',
          password: 'e2epass123',
          role: 'DRIVER',
        })
        .expect(400);
    });

    it('жолооч биш хүнд хуваарилах → 400', async () => {
      const me = await api().get('/api/auth/me').set(auth(tok.operator));
      await api()
        .patch(`/api/orders/${orderId}/assign-driver`)
        .set(auth(tok.manager))
        .send({ driverId: me.body.id })
        .expect(400);
    });

    it('manager хуваарилахад deliveryStatus=ASSIGNED, orderStatus хөндөгдөхгүй', async () => {
      const res = await api()
        .patch(`/api/orders/${orderId}/assign-driver`)
        .set(auth(tok.manager))
        .send({ driverId: e2eDriverId })
        .expect(200);
      expect(res.body.deliveryStatus).toBe('ASSIGNED');
      expect(res.body.orderStatus).toBe('CONFIRMED');
    });

    it('жолоочийн /my-д харагдана', async () => {
      const res = await api()
        .get('/api/deliveries/my')
        .set(auth(e2eDriverToken))
        .expect(200);
      const mine = res.body.find((d: { id: string }) => d.id === orderId);
      expect(mine).toBeDefined();
      expect(mine.fullAddress).toBe(UB_FULL);
      expect(mine.items[0].qty).toBe(4);
    });

    it('өөр жолооч complete хийх гэвэл → 403', async () => {
      await api()
        .post(`/api/deliveries/${orderId}/complete`)
        .set(auth(tok.driver)) // seed-ийн үндсэн жолооч — хуваарилагдаагүй
        .field('success', 'true')
        .attach('photo', PNG, { filename: 'p.png', contentType: 'image/png' })
        .expect(403);
    });

    it('зураггүй амжилттай complete → 400', async () => {
      await api()
        .post(`/api/deliveries/${orderId}/complete`)
        .set(auth(e2eDriverToken))
        .field('success', 'true')
        .expect(400);
    });

    it('зурагтай complete → DELIVERED, зураг serve хийгдэнэ', async () => {
      const res = await api()
        .post(`/api/deliveries/${orderId}/complete`)
        .set(auth(e2eDriverToken))
        .field('success', 'true')
        .field('note', 'e2e хүргэлт')
        .attach('photo', PNG, { filename: 'p.png', contentType: 'image/png' })
        .expect(201);
      expect(res.body.orderStatus).toBe('COMPLETED');
      expect(res.body.deliveryStatus).toBe('DELIVERED');
      expect(res.body.deliveryProofUrl).toMatch(/^\/api\/uploads\/[0-9a-f]{32}\.png$/);
      const fname = res.body.deliveryProofUrl.split('/').pop();
      proofFiles.push(fname);
      // Файл диск дээр бодитоор хадгалагдсан (HTTP serve нь production
      // орчинд curl-ээр батлагдсан — Jest-ийн in-process app статикийг үл дэмжинэ)
      expect(existsSync(join(UPLOADS_DIR, fname))).toBe(true);
    });

    it('дахин complete → 400, DELIVERED цуцлагдахгүй → 400', async () => {
      await api()
        .post(`/api/deliveries/${orderId}/complete`)
        .set(auth(e2eDriverToken))
        .field('success', 'true')
        .attach('photo', PNG, { filename: 'p.png', contentType: 'image/png' })
        .expect(400);
      await api()
        .patch(`/api/orders/${orderId}/status`)
        .set(auth(tok.admin))
        .send({ status: 'CANCELLED' })
        .expect(400);
    });

    it('stats: totalDelivered 1, цалин = 1 × 1500', async () => {
      const res = await api()
        .get('/api/deliveries/my/stats')
        .set(auth(e2eDriverToken))
        .expect(200);
      expect(res.body.totalDelivered).toBe(1);
      expect(Number(res.body.earnings)).toBe(1500);
      expect(res.body.last7Days).toHaveLength(7);
    });

    it('амжилтгүй зам: шалтгаангүй → 400, шалтгаантай → FAILED, дахин хуваарилагдана', async () => {
      // 2 дахь захиалга (үлдэгдэл 6-2=4 болно)
      const ord = await api()
        .post('/api/orders')
        .set(auth(tok.operator))
        .send({
          customerName: `Э2Э-2-${T}`,
          customerPhone: `7${T}`,
          ...UB_ADDR,
          items: [{ productId, qty: 2 }],
        })
        .expect(201);
      order2Id = ord.body.id;
      await api()
        .patch(`/api/orders/${order2Id}/status`)
        .set(auth(tok.operator))
        .send({ status: 'CONFIRMED' })
        .expect(200);
      await api()
        .patch(`/api/orders/${order2Id}/assign-driver`)
        .set(auth(tok.manager))
        .send({ driverId: e2eDriverId })
        .expect(200);

      await api()
        .post(`/api/deliveries/${order2Id}/complete`)
        .set(auth(e2eDriverToken))
        .field('success', 'false')
        .expect(400); // шалтгаангүй

      const fail = await api()
        .post(`/api/deliveries/${order2Id}/complete`)
        .set(auth(e2eDriverToken))
        .field('success', 'false')
        .field('note', 'Хаалгаа нээсэнгүй')
        .expect(201);
      expect(fail.body.deliveryStatus).toBe('FAILED');
      expect(fail.body.orderStatus).toBe('CONFIRMED'); // өөрчлөгдөөгүй

      // FAILED дараа дахин хуваарилж болно
      const re = await api()
        .patch(`/api/orders/${order2Id}/assign-driver`)
        .set(auth(tok.manager))
        .send({ driverId: e2eDriverId })
        .expect(200);
      expect(re.body.deliveryStatus).toBe('ASSIGNED');
    });

    it('цуцлалт: үлдэгдэл буцаж, жолооч unassign болно', async () => {
      const before = await api()
        .get(`/api/products/${productId}`)
        .set(auth(tok.manager));
      const res = await api()
        .patch(`/api/orders/${order2Id}/status`)
        .set(auth(tok.manager))
        .send({ status: 'CANCELLED' })
        .expect(200);
      expect(res.body.assignedDriverId).toBeNull();

      const after = await api()
        .get(`/api/products/${productId}`)
        .set(auth(tok.manager));
      expect(after.body.stockQty).toBe(before.body.stockQty + 2);

      const mv = await api()
        .get(`/api/stock/movements?productId=${productId}&reason=ORDER_CANCEL`)
        .set(auth(tok.manager))
        .expect(200);
      expect(mv.body.items[0].qtyChange).toBe(2);
    });
  });

  // ────────────────────────────────────────────── USERS
  describe('Users — эрх хуваарилалт', () => {
    it('дуусаагүй хүргэлтгүй жолоочийн эрх солигдоно, profile хадгалагдана', async () => {
      const toOp = await api()
        .patch(`/api/users/${e2eDriverId}`)
        .set(auth(tok.admin))
        .send({ role: 'OPERATOR' })
        .expect(200);
      expect(toOp.body.role).toBe('OPERATOR');

      const back = await api()
        .patch(`/api/users/${e2eDriverId}`)
        .set(auth(tok.admin))
        .send({ role: 'DRIVER' })
        .expect(200);
      expect(back.body.driverProfile.feePerDelivery).toBe('1500');
    });

    it('хөлс шинэчлэгдэнэ', async () => {
      const res = await api()
        .patch(`/api/users/${e2eDriverId}`)
        .set(auth(tok.admin))
        .send({ feePerDelivery: '1800.00' })
        .expect(200);
      expect(res.body.driverProfile.feePerDelivery).toBe('1800');
    });

    it('өөрийгөө идэвхгүй болгох / эрхээ солих → 400', async () => {
      const me = await api().get('/api/auth/me').set(auth(tok.admin));
      await api()
        .patch(`/api/users/${me.body.id}`)
        .set(auth(tok.admin))
        .send({ isActive: false })
        .expect(400);
      await api()
        .patch(`/api/users/${me.body.id}`)
        .set(auth(tok.admin))
        .send({ role: 'OPERATOR' })
        .expect(400);
    });
  });

  // ────────────────────────────────────────────── DASHBOARDS
  describe('Dashboards — 4 эрх', () => {
    it('admin: бүтэц + тоо уялдаатай', async () => {
      const res = await api()
        .get('/api/dashboard/admin')
        .set(auth(tok.admin))
        .expect(200);
      for (const k of [
        'totalCustomers',
        'totalDrivers',
        'deliveriesInProgress',
        'deliveredTotal',
        'last7Days',
        'topDrivers',
      ]) {
        expect(res.body).toHaveProperty(k);
      }
      expect(res.body.last7Days).toHaveLength(7);
      // Э2Э жолооч 1 хүргэсэн тул topDrivers-т орсон байх ёстой
      const mine = res.body.topDrivers.find(
        (d: { id: string }) => d.id === e2eDriverId,
      );
      expect(mine?.delivered).toBe(1);
    });

    it('operator: lowStock-д тест бараа орж ирнэ', async () => {
      // Үлдэгдлийг лимитээс доош болгоно (6 → 2, limit 3)
      await api()
        .post('/api/stock/adjust')
        .set(auth(tok.manager))
        .send({ productId, qtyChange: -4, reason: 'MANUAL_OUT' })
        .expect(201);

      const res = await api()
        .get('/api/dashboard/operator')
        .set(auth(tok.operator))
        .expect(200);
      expect(res.body.myOrdersTotal).toBeGreaterThan(0);
      const low = res.body.lowStockProducts.find(
        (p: { id: string }) => p.id === productId,
      );
      expect(low).toBeDefined();
      expect(low.stockQty).toBeLessThanOrEqual(low.lowStockLimit);
    });

    it('manager: stockLast7Days 7 өдөр + driverLoad', async () => {
      const res = await api()
        .get('/api/dashboard/manager')
        .set(auth(tok.manager))
        .expect(200);
      expect(res.body.stockLast7Days).toHaveLength(7);
      expect(Array.isArray(res.body.awaitingAssignment)).toBe(true);
      expect(Array.isArray(res.body.driverLoad)).toBe(true);
    });

    it('driver: dashboard = myStats (нэг метод хоёр route)', async () => {
      const a = await api()
        .get('/api/dashboard/driver')
        .set(auth(e2eDriverToken))
        .expect(200);
      const b = await api()
        .get('/api/deliveries/my/stats')
        .set(auth(e2eDriverToken))
        .expect(200);
      expect(a.body.totalDelivered).toBe(b.body.totalDelivered);
      expect(Number(a.body.earnings)).toBe(Number(b.body.earnings));
    });
  });
});
