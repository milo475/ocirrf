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
  let permUserId: string; // permission panel-ын тестийн оператор
  let permUserToken: string;
  let financeOrderId: string; // гараар COMPLETED болгох санхүүгийн тест
  const financeEntryIds: string[] = []; // гараар бүртгэсэн гүйлгээнүүд
  let payoutId: string; // жолоочийн цалингийн тооцоо
  let roA: string; // маршрутын дарааллын тест захиалгууд
  let roB: string;
  let e2eMgrId: string; // default матрицын шалгалтын менежер
  let custUserId: string; // portal-ын тест харилцагч
  let custToken: string;
  let custOrderId: string;
  let custOrder2Id: string;
  const testStartedAt = new Date(); // ActivityLog цэвэрлэгээнд
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
    const orderIds = [
      orderId,
      order2Id,
      adminOrderId,
      financeOrderId,
      roA,
      roB,
      custOrderId,
      custOrder2Id,
    ].filter(Boolean);
    await prisma.financeEntry.deleteMany({
      where: {
        OR: [
          { id: { in: financeEntryIds } },
          { refOrderId: { in: orderIds } },
          ...(payoutId ? [{ refOrderId: payoutId }] : []),
        ],
      },
    });
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
    if (payoutId) {
      // Захиалгууд дээр устсан тул FK-гүй
      await prisma.driverPayout.deleteMany({ where: { id: payoutId } });
    }
    // Тестийн үеэр үүссэн мэдэгдэл (бодит admin/manager-т очсон) + үйлдлийн түүх
    await prisma.notification.deleteMany({
      where: { refId: { in: [...orderIds, productId].filter(Boolean) } },
    });
    await prisma.activityLog.deleteMany({
      where: { createdAt: { gte: testStartedAt } },
    });
    // Тестийн тохиргоонуудыг цэвэрлэнэ
    await prisma.setting.deleteMany({
      where: {
        key: { in: ['companyName', 'companyPhone', 'allowCustomerCancel'] },
      },
    });
    if (e2eDriverId) {
      await prisma.driverProfile.deleteMany({ where: { userId: e2eDriverId } });
      await prisma.user.deleteMany({ where: { id: e2eDriverId } });
    }
    if (permUserId) {
      // UserPermission-ууд cascade-аар устна
      await prisma.user.deleteMany({ where: { id: permUserId } });
    }
    if (custUserId) {
      // Захиалгууд нь дээр устсан, мэдэгдэл cascade-аар устна
      await prisma.user.deleteMany({ where: { id: custUserId } });
    }
    if (e2eMgrId) {
      await prisma.user.deleteMany({ where: { id: e2eMgrId } });
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
      // Permission шалгалт service дотор (V3-13) тул body нь DTO-ийн
      // хувьд хүчинтэй байж гэмээ нь 403-ыг харна.
      // Бодит manager-т Permission Panel-аас orders.create олгогдсон байж
      // болох тул DEFAULT матрицыг шинээр үүсгэсэн MANAGER-ээр шалгана.
      const mgr = await api()
        .post('/api/users')
        .set(auth(tok.admin))
        .send({
          email: `e2e-mgr-${T}@ursgal.mn`,
          name: `Э2Э Менежер ${T}`,
          password: 'e2epass123',
          role: 'MANAGER',
        })
        .expect(201);
      e2eMgrId = mgr.body.id;
      const login = await api()
        .post('/api/auth/login')
        .send({ email: `e2e-mgr-${T}@ursgal.mn`, password: 'e2epass123' })
        .expect(200);
      await api()
        .post('/api/orders')
        .set(auth(login.body.accessToken))
        .send({
          customerName: 'Хориотой',
          customerPhone: '99000000',
          ...UB_ADDR,
          items: [
            { productId: '00000000-0000-4000-8000-000000000000', qty: 1 },
          ],
        })
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

      // GET / жагсаалт — shortAddress богино хэлбэр (N4)
      const list = await api()
        .get(`/api/orders?search=${res.body.orderNo}`)
        .set(auth(tok.operator))
        .expect(200);
      expect(list.body.items[0].shortAddress).toBe('ХУД, 11-р хороо');
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
      const admList = await api()
        .get(`/api/orders?search=${admOrd.body.orderNo}`)
        .set(auth(tok.admin))
        .expect(200);
      expect(admList.body.items[0].shortAddress).toBe('Архангай, Эрдэнэбулган');
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
      // Тооцоо хараахан хаагдаагүй — бүгд unpaid-д
      expect(Number(res.body.earnings.unpaid)).toBe(1500);
      expect(Number(res.body.earnings.pendingPayout)).toBe(0);
      expect(Number(res.body.earnings.paidTotal)).toBe(0);
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

  // ────────────────────────────────────────────── PERMISSION PANEL (V3)
  describe('V3: Permission Panel ⭐', () => {
    it('operator панел харах → 403 (permissions.manage байхгүй)', async () => {
      await api()
        .get(`/api/users/${e2eDriverId}/permissions`)
        .set(auth(tok.operator))
        .expect(403);
    });

    it('тестийн оператор үүсгэж, панелын бүтэц зөв', async () => {
      const res = await api()
        .post('/api/users')
        .set(auth(tok.admin))
        .send({
          email: `e2e-perm-${T}@ursgal.mn`,
          name: `Э2Э Перм ${T}`,
          password: 'e2epass123',
          role: 'OPERATOR',
        })
        .expect(201);
      permUserId = res.body.id;
      const login = await api()
        .post('/api/auth/login')
        .send({ email: `e2e-perm-${T}@ursgal.mn`, password: 'e2epass123' })
        .expect(200);
      permUserToken = login.body.accessToken;

      const panel = await api()
        .get(`/api/users/${permUserId}/permissions`)
        .set(auth(tok.admin))
        .expect(200);
      expect(panel.body.role).toBe('OPERATOR');
      expect(panel.body.groups.map((g: { group: string }) => g.group)).toEqual([
        'ORDERS',
        'CUSTOMERS',
        'DRIVERS',
        'INVENTORY',
        'FINANCE',
        'REPORTS',
        'SYSTEM',
      ]);
      type Item = {
        key: string;
        label: string;
        roleDefault: boolean;
        override: boolean | null;
        effective: boolean;
      };
      const orders: Item[] = panel.body.groups[0].items;
      expect(orders.find((i) => i.key === 'orders.create')).toMatchObject({
        label: 'Захиалга үүсгэх',
        roleDefault: true,
        override: null,
        effective: true,
      });
      expect(orders.find((i) => i.key === 'orders.delete')?.effective).toBe(
        false,
      );
    });

    it('override хасах → ШУУД 403 (cache invalidate); null → default буцна', async () => {
      const put = await api()
        .put(`/api/users/${permUserId}/permissions`)
        .set(auth(tok.admin))
        .send({ changes: [{ key: 'orders.create', allowed: false }] })
        .expect(200);
      const item = put.body.groups[0].items.find(
        (i: { key: string }) => i.key === 'orders.create',
      );
      expect(item).toMatchObject({
        roleDefault: true,
        override: false,
        effective: false,
      });

      // Permission шалгалт service-ийн эхэнд — хүчинтэй body-той ч 403
      const probeBody = {
        customerPhone: '99000001',
        ...UB_ADDR,
        items: [{ productId: '00000000-0000-4000-8000-000000000000', qty: 1 }],
      };
      await api()
        .post('/api/orders')
        .set(auth(permUserToken))
        .send(probeBody)
        .expect(403);

      const restored = await api()
        .put(`/api/users/${permUserId}/permissions`)
        .set(auth(tok.admin))
        .send({ changes: [{ key: 'orders.create', allowed: null }] })
        .expect(200);
      const r = restored.body.groups[0].items.find(
        (i: { key: string }) => i.key === 'orders.create',
      );
      expect(r).toMatchObject({ override: null, effective: true });
      // Эрх сэргэсэн — одоо validation-д тулна (400, захиалга үүсээгүй)
      await api()
        .post('/api/orders')
        .set(auth(permUserToken))
        .send({})
        .expect(400);
    });

    it('default-д байхгүй эрх олгож болно; өөрийнхөө permissions.manage хасах → 400', async () => {
      await api()
        .get(`/api/users/${permUserId}/permissions`)
        .set(auth(permUserToken))
        .expect(403);
      await api()
        .put(`/api/users/${permUserId}/permissions`)
        .set(auth(tok.admin))
        .send({ changes: [{ key: 'permissions.manage', allowed: true }] })
        .expect(200);
      await api()
        .get(`/api/users/${permUserId}/permissions`)
        .set(auth(permUserToken))
        .expect(200);

      const res = await api()
        .put(`/api/users/${permUserId}/permissions`)
        .set(auth(permUserToken))
        .send({ changes: [{ key: 'permissions.manage', allowed: false }] })
        .expect(400);
      expect(res.body.message).toContain('боломжгүй');

      // цэвэрлэгээ: admin override-ыг буцаана
      await api()
        .put(`/api/users/${permUserId}/permissions`)
        .set(auth(tok.admin))
        .send({ changes: [{ key: 'permissions.manage', allowed: null }] })
        .expect(200);
    });

    it('manager-аас эрх хасах → 403, буцаах → эрх сэргэнэ (V3-18)', async () => {
      const users = await api()
        .get('/api/users')
        .set(auth(tok.admin))
        .expect(200);
      const managerId = users.body.find(
        (u: { username: string }) => u.username === 'manager@ursgal.mn',
      ).id;

      // Хасахаас ӨМНӨ: guard нь param validation-аас түрүүнд тул
      // санамсаргүй uuid-тэй ч 403 БИШ (404 Захиалга олдсонгүй)
      const FAKE = '00000000-0000-4000-8000-000000000000';
      await api()
        .patch(`/api/orders/${FAKE}/assign-driver`)
        .set(auth(tok.manager))
        .send({ driverId: FAKE })
        .expect(404);

      await api()
        .put(`/api/users/${managerId}/permissions`)
        .set(auth(tok.admin))
        .send({ changes: [{ key: 'orders.assign_driver', allowed: false }] })
        .expect(200);
      await api()
        .patch(`/api/orders/${FAKE}/assign-driver`)
        .set(auth(tok.manager))
        .send({ driverId: FAKE })
        .expect(403);

      // Default руу буцаахад дахин нэвтэрнэ
      await api()
        .put(`/api/users/${managerId}/permissions`)
        .set(auth(tok.admin))
        .send({ changes: [{ key: 'orders.assign_driver', allowed: null }] })
        .expect(200);
      await api()
        .patch(`/api/orders/${FAKE}/assign-driver`)
        .set(auth(tok.manager))
        .send({ driverId: FAKE })
        .expect(404);
    });

    it('ADMIN-ий permission өөрчлөх → 400; буруу түлхүүр → 400', async () => {
      const me = await api().get('/api/auth/me').set(auth(tok.admin));
      const res = await api()
        .put(`/api/users/${me.body.id}/permissions`)
        .set(auth(tok.admin))
        .send({ changes: [{ key: 'orders.view', allowed: false }] })
        .expect(400);
      expect(res.body.message).toBe('Админы эрхийг хязгаарлах боломжгүй');

      await api()
        .put(`/api/users/${permUserId}/permissions`)
        .set(auth(tok.admin))
        .send({ changes: [{ key: 'huurmag.key', allowed: false }] })
        .expect(400);
    });
  });

  // ────────────────────────────────────────────── FINANCE (V3)
  describe('V3: Finance ⭐', () => {
    it('эрхгүй хандалт: driver жагсаалт → 403, operator бүртгэх → 403', async () => {
      await api()
        .get('/api/finance/entries')
        .set(auth(tok.driver))
        .expect(403);
      await api()
        .post('/api/finance/entries')
        .set(auth(tok.operator))
        .send({ type: 'INCOME', category: 'Бусад', amount: '100.00' })
        .expect(403);
    });

    it('manager орлого/зарлага бүртгэнэ', async () => {
      const inc = await api()
        .post('/api/finance/entries')
        .set(auth(tok.manager))
        .send({ type: 'INCOME', category: 'Бусад орлого', amount: '5000.00' })
        .expect(201);
      financeEntryIds.push(inc.body.id);
      expect(inc.body.amount).toBe('5000');

      const exp = await api()
        .post('/api/finance/entries')
        .set(auth(tok.manager))
        .send({
          type: 'EXPENSE',
          category: 'Түрээс',
          amount: '3000.50',
          note: 'Э2Э зарлага',
        })
        .expect(201);
      financeEntryIds.push(exp.body.id);
      expect(exp.body.type).toBe('EXPENSE');
      expect(exp.body.createdBy.fullName).toBeTruthy();
    });

    it('жагсаалт type шүүлтүүртэй', async () => {
      const res = await api()
        .get('/api/finance/entries?type=EXPENSE&limit=50')
        .set(auth(tok.manager))
        .expect(200);
      expect(
        res.body.items.some(
          (e: { id: string }) => e.id === financeEntryIds[1],
        ),
      ).toBe(true);
      expect(
        res.body.items.every((e: { type: string }) => e.type === 'EXPENSE'),
      ).toBe(true);
    });

    it('DELIVERED мөчид авто INCOME (category ORDER), давхардахгүй', async () => {
      const res = await api()
        .get('/api/finance/entries?type=INCOME&limit=100')
        .set(auth(tok.admin))
        .expect(200);
      const auto = res.body.items.filter(
        (e: { refOrderId: string | null }) => e.refOrderId === orderId,
      );
      expect(auto).toHaveLength(1);
      expect(auto[0].category).toBe('ORDER');
      expect(auto[0].amount).toBe('4000');
    });

    it('гараар COMPLETED болгоход ч авто орлого бүртгэгдэнэ', async () => {
      const ord = await api()
        .post('/api/orders')
        .set(auth(tok.operator))
        .send({
          customerName: `Э2Э-Санхүү-${T}`,
          customerPhone: `7${T}`,
          ...UB_ADDR,
          items: [{ productId, qty: 1 }],
        })
        .expect(201);
      financeOrderId = ord.body.id;
      for (const s of ['CONFIRMED', 'PREPARING', 'READY', 'COMPLETED']) {
        await api()
          .patch(`/api/orders/${financeOrderId}/status`)
          .set(auth(tok.operator))
          .send({ status: s })
          .expect(200);
      }
      const res = await api()
        .get('/api/finance/entries?type=INCOME&limit=100')
        .set(auth(tok.admin))
        .expect(200);
      const auto = res.body.items.filter(
        (e: { refOrderId: string | null }) => e.refOrderId === financeOrderId,
      );
      expect(auto).toHaveLength(1);
      expect(auto[0].amount).toBe('1000');
    });

    it('summary: өдөр тутмын мөрүүд + нийлбэрүүд', async () => {
      const res = await api()
        .get('/api/finance/summary?days=1')
        .set(auth(tok.manager))
        .expect(200);
      expect(res.body.byDay).toHaveLength(1);
      // Өнөөдрийн тестийн гүйлгээнүүд: 5000 + авто 4000 + 1000 орлого, 3000.5 зарлага
      expect(Number(res.body.income)).toBeGreaterThanOrEqual(10000);
      expect(Number(res.body.expense)).toBeGreaterThanOrEqual(3000.5);
      expect(Number(res.body.net)).toBe(
        Number(res.body.income) - Number(res.body.expense),
      );
      // operator-т summary хаалттай
      await api()
        .get('/api/finance/summary')
        .set(auth(tok.operator))
        .expect(403);
    });
  });

  // ────────────────────────────────────────────── PAYROLL (V3)
  describe('V3: Payroll ⭐', () => {
    it('operator pending харах → 403', async () => {
      await api()
        .get('/api/finance/payroll/pending')
        .set(auth(tok.operator))
        .expect(403);
    });

    it('pending: e2e жолооч 1 хүргэлт × 1800 дүнтэй гарна', async () => {
      const res = await api()
        .get('/api/finance/payroll/pending')
        .set(auth(tok.manager))
        .expect(200);
      const row = res.body.find(
        (r: { driverId: string }) => r.driverId === e2eDriverId,
      );
      expect(row).toBeDefined();
      expect(row.deliveredCount).toBe(1);
      // Users тестэд хөлс 1800 болж шинэчлэгдсэн
      expect(row.feePerDelivery).toBe('1800');
      expect(row.amount).toBe('1800');
    });

    it('close: payout + EXPENSE entry үүсч, дахин тооцогдохгүй', async () => {
      const res = await api()
        .post('/api/finance/payroll/close')
        .set(auth(tok.manager))
        .send({ driverId: e2eDriverId })
        .expect(201);
      payoutId = res.body.id;
      expect(res.body.status).toBe('PENDING');
      expect(res.body.deliveredCount).toBe(1);
      expect(res.body.totalAmount).toBe('1800');
      expect(res.body.paidAt).toBeNull();

      // pending-ээс алга болно
      const pending = await api()
        .get('/api/finance/payroll/pending')
        .set(auth(tok.manager))
        .expect(200);
      expect(
        pending.body.some(
          (r: { driverId: string }) => r.driverId === e2eDriverId,
        ),
      ).toBe(false);

      // EXPENSE entry автоматаар (refOrderId = payout.id)
      const entries = await api()
        .get('/api/finance/entries?type=EXPENSE&limit=100')
        .set(auth(tok.manager))
        .expect(200);
      const payrollEntry = entries.body.items.find(
        (e: { refOrderId: string | null }) => e.refOrderId === payoutId,
      );
      expect(payrollEntry.category).toBe('DRIVER_PAYROLL');
      expect(payrollEntry.amount).toBe('1800');

      // дахин close → тооцоо хийх хүргэлт алга
      await api()
        .post('/api/finance/payroll/close')
        .set(auth(tok.manager))
        .send({ driverId: e2eDriverId })
        .expect(400);
    });

    it('stats: unpaid 0 болж pendingPayout руу шилжсэн', async () => {
      const res = await api()
        .get('/api/deliveries/my/stats')
        .set(auth(e2eDriverToken))
        .expect(200);
      expect(Number(res.body.earnings.unpaid)).toBe(0);
      expect(res.body.earnings.pendingPayout).toBe('1800');
      expect(Number(res.body.earnings.paidTotal)).toBe(0);
    });

    it('pay: PAID + paidAt; driver-ийн paidTotal өссөн; түүхэнд гарна', async () => {
      const res = await api()
        .patch(`/api/finance/payroll/${payoutId}/pay`)
        .set(auth(tok.admin))
        .expect(200);
      expect(res.body.status).toBe('PAID');
      expect(res.body.paidAt).toBeTruthy();

      // дахин pay → 400
      await api()
        .patch(`/api/finance/payroll/${payoutId}/pay`)
        .set(auth(tok.admin))
        .expect(400);

      const stats = await api()
        .get('/api/deliveries/my/stats')
        .set(auth(e2eDriverToken))
        .expect(200);
      expect(stats.body.earnings.paidTotal).toBe('1800');
      expect(Number(stats.body.earnings.pendingPayout)).toBe(0);

      const hist = await api()
        .get(`/api/finance/payroll?driverId=${e2eDriverId}&status=PAID`)
        .set(auth(tok.manager))
        .expect(200);
      expect(hist.body.some((p: { id: string }) => p.id === payoutId)).toBe(
        true,
      );
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
        'totalIncome',
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
      expect(Number(a.body.earnings.unpaid)).toBe(
        Number(b.body.earnings.unpaid),
      );
      expect(Number(a.body.earnings.paidTotal)).toBe(
        Number(b.body.earnings.paidTotal),
      );
    });
  });

  // ────────────────────────────────────────────── NOTIFICATIONS + ACTIVITY LOG (V3)
  describe('V3: Notifications + ActivityLog ⭐', () => {
    it('жолоочид DELIVERY_ASSIGNED очсон; унших урсгал', async () => {
      const res = await api()
        .get('/api/notifications?limit=50')
        .set(auth(e2eDriverToken))
        .expect(200);
      const assigned = res.body.items.filter(
        (n: { type: string }) => n.type === 'DELIVERY_ASSIGNED',
      );
      expect(assigned.length).toBeGreaterThanOrEqual(1);
      expect(assigned[0].title).toContain('Шинэ хүргэлт');
      expect(assigned[0].refType).toBe('order');

      const before = await api()
        .get('/api/notifications/unread-count')
        .set(auth(e2eDriverToken))
        .expect(200);
      expect(before.body.count).toBeGreaterThanOrEqual(1);

      const read = await api()
        .patch(`/api/notifications/${assigned[0].id}/read`)
        .set(auth(e2eDriverToken))
        .expect(200);
      expect(read.body.isRead).toBe(true);

      await api()
        .post('/api/notifications/read-all')
        .set(auth(e2eDriverToken))
        .expect(201);
      const after = await api()
        .get('/api/notifications/unread-count')
        .set(auth(e2eDriverToken))
        .expect(200);
      expect(after.body.count).toBe(0);

      // Бусдын мэдэгдэл унших → 404
      await api()
        .patch(`/api/notifications/${assigned[0].id}/read`)
        .set(auth(tok.admin))
        .expect(404);
    });

    it('LOW_STOCK: лимит давах МӨЧИД нэг л удаа, өдөрт давхардахгүй', async () => {
      const mine = async () => {
        const res = await api()
          .get('/api/notifications?limit=100')
          .set(auth(tok.admin))
          .expect(200);
        return res.body.items.filter(
          (n: { type: string; refId: string | null }) =>
            n.type === 'LOW_STOCK' && n.refId === productId,
        );
      };
      // Dashboards тестийн −4 зарлага лимит давсан мөчид 1 мэдэгдэл үүсгэсэн
      expect(await mine()).toHaveLength(1);

      // Лимитээс доош байхад дахин хасах → шинэ мэдэгдэл ҮГҮЙ
      await api()
        .post('/api/stock/adjust')
        .set(auth(tok.manager))
        .send({ productId, qtyChange: -1, reason: 'MANUAL_OUT' })
        .expect(201);
      expect(await mine()).toHaveLength(1);

      // Дээш гаргаад дахин доош — өдөрт 1 дүрмээр мөн л нэмэгдэхгүй
      await api()
        .post('/api/stock/adjust')
        .set(auth(tok.manager))
        .send({ productId, qtyChange: 10, reason: 'PURCHASE_IN' })
        .expect(201);
      await api()
        .post('/api/stock/adjust')
        .set(auth(tok.manager))
        .send({ productId, qtyChange: -9, reason: 'MANUAL_OUT' })
        .expect(201);
      expect(await mine()).toHaveLength(1);
    });

    it('DELIVERY_FAILED: ADMIN/MANAGER-үүдэд очсон', async () => {
      const res = await api()
        .get('/api/notifications?limit=100')
        .set(auth(tok.manager))
        .expect(200);
      const failed = res.body.items.find(
        (n: { type: string; refId: string | null }) =>
          n.type === 'DELIVERY_FAILED' && n.refId === order2Id,
      );
      expect(failed).toBeDefined();
      expect(failed.body).toBe('Хаалгаа нээсэнгүй');
    });

    it('activity-log: бичилтүүд + permission_change + эрхийн шалгалт', async () => {
      // operator-т эрх байхгүй
      await api()
        .get('/api/activity-log')
        .set(auth(tok.operator))
        .expect(403);

      const orders = await api()
        .get('/api/activity-log?entity=orders&limit=100')
        .set(auth(tok.admin))
        .expect(200);
      expect(
        orders.body.items.some((i: { action: string }) =>
          i.action.startsWith('POST'),
        ),
      ).toBe(true);
      expect(orders.body.items[0].userName).toBeTruthy();

      const perms = await api()
        .get('/api/activity-log?entity=permissions&limit=100')
        .set(auth(tok.admin))
        .expect(200);
      const change = perms.body.items.find(
        (i: { action: string; meta: { permKey?: string } | null }) =>
          i.action === 'permission_change' &&
          i.meta?.permKey === 'orders.create',
      );
      expect(change).toBeDefined();
      expect(change.entityId).toBe(permUserId);

      // auth хүсэлтүүд бичигдээгүй
      const auth0 = await api()
        .get('/api/activity-log?entity=auth')
        .set(auth(tok.admin))
        .expect(200);
      expect(auth0.body.total).toBe(0);
    });
  });

  // ────────────────────────────────────────────── DELIVERY OPS + ROUTE (V3)
  describe('V3: Delivery Ops + маршрут ⭐', () => {
    it('operator board харах → 403 (drivers.view байхгүй)', async () => {
      await api()
        .get('/api/delivery-ops/board')
        .set(auth(tok.operator))
        .expect(403);
    });

    it('2 хүргэлт бэлдэж board дээр бүлэглэгдэнэ', async () => {
      // Үлдэгдэл нэмээд 2 захиалга үүсгэж e2e жолоочид хуваарилна
      await api()
        .post('/api/stock/adjust')
        .set(auth(tok.manager))
        .send({ productId, qtyChange: 5, reason: 'PURCHASE_IN' })
        .expect(201);
      for (const which of ['A', 'B']) {
        const ord = await api()
          .post('/api/orders')
          .set(auth(tok.operator))
          .send({
            customerName: `Э2Э-Маршрут-${which}-${T}`,
            customerPhone: `6${T}`,
            ...UB_ADDR,
            items: [{ productId, qty: 1 }],
          })
          .expect(201);
        if (which === 'A') roA = ord.body.id;
        else roB = ord.body.id;
        await api()
          .patch(`/api/orders/${ord.body.id}/status`)
          .set(auth(tok.operator))
          .send({ status: 'CONFIRMED' })
          .expect(200);
        await api()
          .patch(`/api/orders/${ord.body.id}/assign-driver`)
          .set(auth(tok.manager))
          .send({ driverId: e2eDriverId })
          .expect(200);
      }

      const res = await api()
        .get('/api/delivery-ops/board')
        .set(auth(tok.manager))
        .expect(200);
      const assignedIds = res.body.board.ASSIGNED.map(
        (o: { id: string }) => o.id,
      );
      expect(assignedIds).toEqual(expect.arrayContaining([roA, roB]));
      const rowA = res.body.board.ASSIGNED.find(
        (o: { id: string }) => o.id === roA,
      );
      expect(rowA.shortAddress).toBe('ХУД, 11-р хороо');
      expect(rowA.assignedDriver.id).toBe(e2eDriverId);

      const drv = res.body.drivers.find(
        (d: { id: string }) => d.id === e2eDriverId,
      );
      expect(drv.active).toBe(2);
      expect(drv).toHaveProperty('deliveredToday');
    });

    it('route-order: дараалал тавьж my/deliveries эрэмбэлэгдэнэ + mapUrl', async () => {
      // B-г эхэнд тавина
      await api()
        .patch('/api/deliveries/route-order')
        .set(auth(tok.manager))
        .send({ driverId: e2eDriverId, orderIds: [roB, roA] })
        .expect(200);

      const res = await api()
        .get('/api/deliveries/my')
        .set(auth(e2eDriverToken))
        .expect(200);
      expect(res.body[0].id).toBe(roB);
      expect(res.body[0].routeOrder).toBe(1);
      expect(res.body[1].id).toBe(roA);
      expect(res.body[1].routeOrder).toBe(2);
      expect(res.body[0].mapUrl).toBe(
        'https://www.google.com/maps/search/?api=1&query=' +
          encodeURIComponent(res.body[0].fullAddress),
      );
    });

    it('идэвхтэй биш захиалга оруулбал → 400; цэвэрлэгээ', async () => {
      await api()
        .patch('/api/deliveries/route-order')
        .set(auth(tok.manager))
        .send({ driverId: e2eDriverId, orderIds: [roB, orderId] })
        .expect(400);
      // operator drivers.assign байхгүй → 403
      await api()
        .patch('/api/deliveries/route-order')
        .set(auth(tok.operator))
        .send({ driverId: e2eDriverId, orderIds: [roB] })
        .expect(403);
      // цуцалж үлдэгдэл буцаана
      for (const id of [roA, roB]) {
        await api()
          .patch(`/api/orders/${id}/status`)
          .set(auth(tok.manager))
          .send({ status: 'CANCELLED' })
          .expect(200);
      }
    });
  });

  // ────────────────────────────────────────────── CUSTOMER PORTAL (V3)
  describe('V3: Customer Portal ⭐', () => {
    it('бүртгэл: CUSTOMER үүсч токен авна; давхардсан имэйл → 409', async () => {
      const reg = await api()
        .post('/api/auth/register')
        .send({
          name: 'Э2Э Портал Харилцагч',
          email: `e2e-cust-${T}@mail.mn`,
          phone: '99887700',
          password: 'custpass1',
        })
        .expect(201);
      custUserId = reg.body.user.id;
      custToken = reg.body.accessToken;
      expect(reg.body.user.role).toBe('CUSTOMER');
      expect(reg.body.user.permissions).toEqual([]);

      await api()
        .post('/api/auth/register')
        .send({
          name: 'Давхар',
          email: `e2e-cust-${T}@mail.mn`,
          phone: '99887701',
          password: 'custpass2',
        })
        .expect(409);
    });

    it('customer staff API-д хандахгүй (бүгд 403)', async () => {
      for (const path of ['/api/orders', '/api/products', '/api/users']) {
        await api().get(path).set(auth(custToken)).expect(403);
      }
    });

    it('захиалга үүсгэнэ: утас/нэр профайлоос, staff-тай ижил transaction', async () => {
      const before = await api()
        .get(`/api/products/${productId}`)
        .set(auth(tok.manager))
        .expect(200);

      const ord = await api()
        .post('/api/orders')
        .set(auth(custToken))
        .send({ ...UB_ADDR, items: [{ productId, qty: 1 }] })
        .expect(201);
      custOrderId = ord.body.id;
      expect(ord.body.customerId).toBe(custUserId);
      expect(ord.body.phone).toBe('99887700'); // профайлын утас
      expect(ord.body.customerName).toBe('Э2Э Портал Харилцагч');

      const after = await api()
        .get(`/api/products/${productId}`)
        .set(auth(tok.manager))
        .expect(200);
      expect(after.body.stockQty).toBe(before.body.stockQty - 1);

      // operator-т онлайн захиалгын мэдэгдэл очсон
      const notifs = await api()
        .get('/api/notifications?limit=50')
        .set(auth(tok.operator))
        .expect(200);
      const mine = notifs.body.items.find(
        (n: { type: string; refId: string | null }) =>
          n.type === 'CUSTOMER_ORDER' && n.refId === custOrderId,
      );
      expect(mine.title).toContain('Шинэ онлайн захиалга');
    });

    it('portal: жагсаалт, дэлгэрэнгүй (хязгаарлагдмал), бусдынх 403', async () => {
      const list = await api()
        .get('/api/portal/orders')
        .set(auth(custToken))
        .expect(200);
      expect(
        list.body.items.some((o: { id: string }) => o.id === custOrderId),
      ).toBe(true);

      // Статус ахиулахад customer-т мэдэгдэл очно
      await api()
        .patch(`/api/orders/${custOrderId}/status`)
        .set(auth(tok.admin))
        .send({ status: 'CONFIRMED' })
        .expect(200);
      const notifs = await api()
        .get('/api/notifications?limit=20')
        .set(auth(custToken))
        .expect(200);
      expect(
        notifs.body.items.some(
          (n: { type: string; title: string }) =>
            n.type === 'ORDER_STATUS' && n.title.includes('Баталгаажсан'),
        ),
      ).toBe(true);

      const detail = await api()
        .get(`/api/portal/orders/${custOrderId}`)
        .set(auth(custToken))
        .expect(200);
      expect(detail.body.orderStatus).toBe('CONFIRMED');
      expect(detail.body.items).toHaveLength(1);
      expect(detail.body.fullAddress).toBe(UB_FULL);
      expect(detail.body).not.toHaveProperty('createdById');
      expect(detail.body.assignedDriver).toBeNull();

      // Бусдын захиалга → 403; staff portal-д хандахгүй → 403
      await api()
        .get(`/api/portal/orders/${orderId}`)
        .set(auth(custToken))
        .expect(403);
      await api()
        .get('/api/portal/orders')
        .set(auth(tok.admin))
        .expect(403);
    });

    it('portal dashboard: тоонууд зөв', async () => {
      const res = await api()
        .get('/api/portal/dashboard')
        .set(auth(custToken))
        .expect(200);
      expect(res.body.totalOrders).toBe(1);
      expect(res.body.activeOrders).toBe(1);
      expect(res.body.recentOrders[0].id).toBe(custOrderId);
    });

    it('profile: нэр/утас/нууц үг солино (имэйл хэвээр)', async () => {
      const res = await api()
        .patch('/api/portal/profile')
        .set(auth(custToken))
        .send({ name: 'Шинэ Нэр', phone: '99887711' })
        .expect(200);
      expect(res.body.name).toBe('Шинэ Нэр');
      expect(res.body.phone).toBe('99887711');
      expect(res.body.email).toBe(`e2e-cust-${T}@mail.mn`);

      await api()
        .patch('/api/portal/profile')
        .set(auth(custToken))
        .send({ password: 'newpass99' })
        .expect(200);
      await api()
        .post('/api/auth/login')
        .send({ email: `e2e-cust-${T}@mail.mn`, password: 'custpass1' })
        .expect(401);
      const relogin = await api()
        .post('/api/auth/login')
        .send({ email: `e2e-cust-${T}@mail.mn`, password: 'newpass99' })
        .expect(200);
      custToken = relogin.body.accessToken;
    });

    it('цуцлалт: хаалттай үед 403; нээлттэй үед зөвхөн NEW, үлдэгдэл буцна', async () => {
      // Тохиргоо Settings-ээс уншигдана (V3-16)
      await api()
        .put('/api/settings')
        .set(auth(tok.admin))
        .send({ allowCustomerCancel: 'false' })
        .expect(200);
      const ord2 = await api()
        .post('/api/orders')
        .set(auth(custToken))
        .send({ ...UB_ADDR, items: [{ productId, qty: 1 }] })
        .expect(201);
      custOrder2Id = ord2.body.id;

      await api()
        .patch(`/api/portal/orders/${custOrder2Id}/cancel`)
        .set(auth(custToken))
        .expect(403);

      await api()
        .put('/api/settings')
        .set(auth(tok.admin))
        .send({ allowCustomerCancel: 'true' })
        .expect(200);
      // CONFIRMED захиалга цуцлагдахгүй
      await api()
        .patch(`/api/portal/orders/${custOrderId}/cancel`)
        .set(auth(custToken))
        .expect(400);

      const before = await api()
        .get(`/api/products/${productId}`)
        .set(auth(tok.manager))
        .expect(200);
      const res = await api()
        .patch(`/api/portal/orders/${custOrder2Id}/cancel`)
        .set(auth(custToken))
        .expect(200);
      expect(res.body.orderStatus).toBe('CANCELLED');
      const after = await api()
        .get(`/api/products/${productId}`)
        .set(auth(tok.manager))
        .expect(200);
      expect(after.body.stockQty).toBe(before.body.stockQty + 1);
      await api()
        .put('/api/settings')
        .set(auth(tok.admin))
        .send({ allowCustomerCancel: 'false' })
        .expect(200);
    });
  });

  // ────────────────────────────────────────────── SETTINGS + ANALYTICS + REPORTS (V3)
  describe('V3: Settings + Analytics + Reports ⭐', () => {
    it('settings: public унших, edit эрхтэйд л, буруу утга 400', async () => {
      const pub = await api()
        .get('/api/settings')
        .set(auth(tok.operator))
        .expect(200);
      expect(pub.body).toHaveProperty('companyName');
      expect(pub.body.allowCustomerCancel).toBe('false');

      await api()
        .put('/api/settings')
        .set(auth(tok.manager))
        .send({ companyName: 'X' })
        .expect(403);

      const upd = await api()
        .put('/api/settings')
        .set(auth(tok.admin))
        .send({ companyName: 'Э2Э Компани', companyPhone: '70001111' })
        .expect(200);
      expect(upd.body.companyName).toBe('Э2Э Компани');

      const pub2 = await api()
        .get('/api/settings')
        .set(auth(tok.driver))
        .expect(200);
      expect(pub2.body.companyName).toBe('Э2Э Компани');

      await api()
        .put('/api/settings')
        .set(auth(tok.admin))
        .send({ huurmagKey: 'x' })
        .expect(400);
      await api()
        .put('/api/settings')
        .set(auth(tok.admin))
        .send({ allowCustomerCancel: 'maybe' })
        .expect(400);
    });

    it('analytics: manager нэвтэрнэ, operator 403, тоонууд зөв', async () => {
      await api()
        .get('/api/analytics/sales')
        .set(auth(tok.operator))
        .expect(403);

      const sales = await api()
        .get('/api/analytics/sales?groupBy=day')
        .set(auth(tok.manager))
        .expect(200);
      expect(sales.body.totals.count).toBeGreaterThanOrEqual(1);
      expect(sales.body.rows.length).toBeGreaterThanOrEqual(1);
      const week = await api()
        .get('/api/analytics/sales?groupBy=week')
        .set(auth(tok.manager))
        .expect(200);
      expect(week.body.groupBy).toBe('week');

      const top = await api()
        .get('/api/analytics/top-products?limit=50')
        .set(auth(tok.manager))
        .expect(200);
      const mine = top.body.find(
        (p: { productId: string }) => p.productId === productId,
      );
      expect(mine.qty).toBeGreaterThanOrEqual(1);

      const drivers = await api()
        .get('/api/analytics/drivers')
        .set(auth(tok.manager))
        .expect(200);
      const d = drivers.body.find(
        (x: { id: string }) => x.id === e2eDriverId,
      );
      expect(d.delivered).toBeGreaterThanOrEqual(1);
      expect(Number(d.earnings)).toBe(d.delivered * 1800);

      const cust = await api()
        .get('/api/analytics/customers')
        .set(auth(tok.manager))
        .expect(200);
      expect(cust.body.topCustomers.length).toBeGreaterThanOrEqual(1);
      expect(
        cust.body.newCustomers + cust.body.repeatCustomers,
      ).toBeGreaterThanOrEqual(1);
    });

    it('reports: BOM-той CSV, монгол багана, permission ялгаа', async () => {
      const res = await api()
        .get('/api/reports/delivery.csv')
        .set(auth(tok.manager))
        .expect(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.text.charCodeAt(0)).toBe(0xfeff); // UTF-8 BOM
      expect(res.text).toContain('Захиалгын дугаар');
      expect(res.text).toContain('ХУД, 11-р хороо');

      await api()
        .get('/api/reports/inventory.csv')
        .set(auth(tok.manager))
        .expect(200);

      // manager-т reports.finance байхгүй
      await api()
        .get('/api/reports/finance.csv')
        .set(auth(tok.manager))
        .expect(403);
      const fin = await api()
        .get('/api/reports/finance.csv')
        .set(auth(tok.admin))
        .expect(200);
      expect(fin.text).toContain('Ангилал');

      await api()
        .get('/api/reports/delivery.csv')
        .set(auth(tok.operator))
        .expect(403);
    });
  });
});
