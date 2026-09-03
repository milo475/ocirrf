import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

/**
 * DEFAULT БАЙГУУЛЛАГА (Multi-tenancy) — migration-ы тогтмол UUID-тай
 * ижил: хуучин өгөгдөл бүгд энэ байгууллагад backfill хийгдсэн байдаг.
 * Seed нь raw PrismaClient ашигладаг (org-scope extension-гүй) тул
 * organizationId-г ХААНА Ч БҮГДЭД нь тодоор өгнө.
 */
export const DEFAULT_ORG_ID = '00000000-0000-4000-8000-000000000001';

async function seedOrganization() {
  await prisma.organization.upsert({
    where: { id: DEFAULT_ORG_ID },
    update: { isActive: true },
    create: { id: DEFAULT_ORG_ID, name: 'ocirrf' },
  });
}

/**
 * APP REGISTRY каталог — migration-ий тогтмол UUID-уудтай ижил.
 * Idempotent: nameMn/descriptionMn зэрэг нь дахин seed-д шинэчлэгдэнэ,
 * харин status-ыг ДАРАХГҮЙ (SUPERADMIN дараа нь консолоос удирдана).
 */
const APP_CATALOG = [
  { id: '00000000-0000-4000-8000-0000000a0001', key: 'ursgal', nameMn: 'Урсгал', nameEn: 'Ursgal', descriptionMn: 'Агуулах, захиалга, хүргэлт, санхүүгийн дотоод удирдлага', icon: 'boxes', color: '#8b2635', status: 'ACTIVE' as const, sortOrder: 1 },
  { id: '00000000-0000-4000-8000-0000000a0002', key: 'sankhuu', nameMn: 'Санхүү / НЯБО', nameEn: 'Finance', descriptionMn: 'Дансны төлөвлөгөө, давхар бичилт, авлага/өглөг, НӨАТ, нэхэмжлэх', icon: 'landmark', color: '#1e6091', status: 'COMING_SOON' as const, sortOrder: 2 },
  { id: '00000000-0000-4000-8000-0000000a0003', key: 'hr', nameMn: 'Хүний нөөц / Цалин', nameEn: 'HR & Payroll', descriptionMn: 'Ажилтны бүртгэл, ирц, амралт чөлөө, цалингийн тооцоо', icon: 'users', color: '#2d6a4f', status: 'COMING_SOON' as const, sortOrder: 3 },
  { id: '00000000-0000-4000-8000-0000000a0004', key: 'crm', nameMn: 'Харилцагч (CRM)', nameEn: 'CRM', descriptionMn: 'Харилцагчийн бүртгэл, борлуулалтын сувгууд, идэвхжүүлэлт', icon: 'heart-handshake', color: '#7b2cbf', status: 'COMING_SOON' as const, sortOrder: 4 },
  { id: '00000000-0000-4000-8000-0000000a0005', key: 'hudaldan-avalt', nameMn: 'Худалдан авалт', nameEn: 'Procurement', descriptionMn: 'Нийлүүлэгчийн үнийн санал, худалдан авалтын захиалга, өглөгийн хяналт', icon: 'shopping-cart', color: '#b5651d', status: 'COMING_SOON' as const, sortOrder: 5 },
  { id: '00000000-0000-4000-8000-0000000a0006', key: 'tailan', nameMn: 'Тайлан / Аналитик', nameEn: 'Reports', descriptionMn: 'Нэгдсэн тайлан, KPI самбар, экспорт', icon: 'chart-column', color: '#457b9d', status: 'COMING_SOON' as const, sortOrder: 6 },
  // ocirrf хаб = 10 систем. 7-10 нь placeholder (COMING_SOON) — нэр/тайлбар/icon-ыг
  // SUPERADMIN консолоос солино; key нь тогтмол.
  { id: '00000000-0000-4000-8000-0000000a0007', key: 'borluulalt', nameMn: 'Борлуулалт / POS', nameEn: 'Sales & POS', descriptionMn: 'Дэлгүүр, кассын борлуулалт, урамшуулал, төлбөрийн бүртгэл', icon: 'store', color: '#c2410c', status: 'COMING_SOON' as const, sortOrder: 7 },
  { id: '00000000-0000-4000-8000-0000000a0008', key: 'tusul', nameMn: 'Төсөл / Даалгавар', nameEn: 'Projects & Tasks', descriptionMn: 'Төслийн самбар, даалгавар, хугацаа, багийн ажлын хуваарь', icon: 'kanban', color: '#0f766e', status: 'COMING_SOON' as const, sortOrder: 8 },
  { id: '00000000-0000-4000-8000-0000000a0009', key: 'barimt', nameMn: 'Баримт бичиг', nameEn: 'Documents', descriptionMn: 'Гэрээ, албан бичиг, хувилбарын хяналт, батлах урсгал', icon: 'file-text', color: '#6d28d9', status: 'COMING_SOON' as const, sortOrder: 9 },
  { id: '00000000-0000-4000-8000-0000000a0010', key: 'tuslamj', nameMn: 'Тусламжийн төв', nameEn: 'Helpdesk', descriptionMn: 'Хэрэглэгчийн хүсэлт, тасалбар, SLA, мэдлэгийн сан', icon: 'life-buoy', color: '#0369a1', status: 'COMING_SOON' as const, sortOrder: 10 },
  // 11 — Studexa: багшийн систем (Django Studexa-г платформ руу шилжүүлсэн, ACTIVE)
  { id: '00000000-0000-4000-8000-0000000a0011', key: 'studexa', nameMn: 'Studexa — Багшийн систем', nameEn: 'Studexa', descriptionMn: 'Сурагчийн бүртгэл, ирц, дүнгийн нэгтгэл, хичээлийн хуваарь, даалгавар, зарлал, төлбөрийн хяналт', icon: 'graduation-cap', color: '#4f46e5', status: 'ACTIVE' as const, sortOrder: 11 },
];

async function seedApplications() {
  for (const app of APP_CATALOG) {
    const { id, status, ...fields } = app;
    await prisma.application.upsert({
      where: { key: app.key },
      // status-ыг update-д оруулахгүй — консолоос солигдсоныг дарахгүй
      update: { nameMn: fields.nameMn, nameEn: fields.nameEn, descriptionMn: fields.descriptionMn, icon: fields.icon, color: fields.color, sortOrder: fields.sortOrder },
      create: { id, status, ...fields },
    });
  }
  // Default байгууллагад ursgal (цөм) ба studexa (11) идэвхтэй
  for (const app of APP_CATALOG.filter((a) => a.status === 'ACTIVE')) {
    await prisma.organizationApp.upsert({
      where: {
        organizationId_applicationId: {
          organizationId: DEFAULT_ORG_ID,
          applicationId: app.id,
        },
      },
      update: {},
      create: {
        organizationId: DEFAULT_ORG_ID,
        applicationId: app.id,
      },
    });
  }
}

async function seedUsers() {
  const users = [
    {
      username: 'admin@ocirrf.mn',
      password: 'admin123',
      fullName: 'Систем Админ',
      role: 'ADMIN' as const,
    },
    {
      username: 'manager@ocirrf.mn',
      password: 'manager123',
      fullName: 'Агуулахын Менежер',
      role: 'MANAGER' as const,
    },
    {
      username: 'seller@ocirrf.mn',
      password: 'seller123',
      fullName: 'Туршилт Борлуулагч',
      role: 'SELLER' as const,
    },
    {
      username: 'operator@ocirrf.mn',
      password: 'operator123',
      fullName: 'Туршилт Оператор',
      role: 'OPERATOR' as const,
    },
    {
      username: 'driver@ocirrf.mn',
      password: 'driver123',
      fullName: 'Хүргэлтийн Жолооч',
      role: 'DRIVER' as const,
    },
    // Нярав. Үүнгүйгээр шинэ суулгацад GET /warehouse/keepers хоосон
    // буцаж, «няравт хуваарилах» урсгал бүхэлдээ ажиллах боломжгүй байв
    // (Role enum-д 6 эрх байхад seed 5-ыг л үүсгэж байсан).
    {
      username: 'warehouse@ocirrf.mn',
      password: 'warehouse123',
      fullName: 'Агуулахын Нярав',
      role: 'WAREHOUSE' as const,
    },
  ];

  const byUsername = new Map<string, string>();
  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    const user = await prisma.user.upsert({
      where: { username: u.username },
      update: { fullName: u.fullName, role: u.role, isActive: true },
      create: {
        username: u.username,
        passwordHash,
        fullName: u.fullName,
        role: u.role,
        organizationId: DEFAULT_ORG_ID,
      },
    });
    byUsername.set(u.username, user.id);
  }
  return byUsername;
}

async function seedDriverProfile(users: Map<string, string>) {
  const driverId = users.get('driver@ocirrf.mn');
  if (!driverId) throw new Error('driver хэрэглэгч олдсонгүй');

  await prisma.driverProfile.upsert({
    where: { userId: driverId },
    update: { feePerDelivery: '3000.00', vehicleInfo: 'Prius 30' },
    create: {
      userId: driverId,
      feePerDelivery: '3000.00', // хүргэлт тутмын хөлс
      vehicleInfo: 'Prius 30',
    },
  });
}

async function seedCategories() {
  const names = ['Хүнс', 'Гэр ахуй', 'Электроник'];
  const byName = new Map<string, string>();

  for (const name of names) {
    const cat = await prisma.category.upsert({
      where: {
        organizationId_name: { organizationId: DEFAULT_ORG_ID, name },
      },
      update: {},
      create: { name, organizationId: DEFAULT_ORG_ID },
    });
    byName.set(name, cat.id);
  }
  return byName;
}

async function seedProducts(
  categories: Map<string, string>,
  users: Map<string, string>,
) {
  // stockQty санаатайгаар янз бүр: 0 (дууссан), лимитээс доош, хэвийн —
  // dashboard-ийн бага үлдэгдлийн анхааруулгыг турших өгөгдөл.
  // lowStockLimit нь зарим нь 5, зарим нь 10.
  const products = [
    { sku: 'UG-0001', name: 'Цагаан будаа 5кг', category: 'Хүнс', price: '28500.00', stockQty: 120, lowStockLimit: 10, unit: 'ш' },
    { sku: 'UG-0002', name: 'Сүү 1л', category: 'Хүнс', price: '4800.00', stockQty: 45, lowStockLimit: 10, unit: 'ш' },
    { sku: 'UG-0003', name: 'Элсэн чихэр 1кг', category: 'Хүнс', price: '3900.00', stockQty: 8, lowStockLimit: 10, unit: 'кг' }, // лимитээс доош
    { sku: 'UG-0004', name: 'Гоймон 400г', category: 'Хүнс', price: '2500.00', stockQty: 0, lowStockLimit: 5, unit: 'ш' }, // дууссан
    { sku: 'UG-0005', name: 'Аяга угаагч шингэн 500мл', category: 'Гэр ахуй', price: '7200.00', stockQty: 30, lowStockLimit: 5, unit: 'ш' },
    { sku: 'UG-0006', name: 'Угаалгын нунтаг 3кг', category: 'Гэр ахуй', price: '24900.00', stockQty: 4, lowStockLimit: 5, unit: 'ш' }, // лимитээс доош
    { sku: 'UG-0007', name: 'LED чийдэн 9Вт', category: 'Электроник', price: '8500.00', stockQty: 60, lowStockLimit: 5, unit: 'ш' },
    { sku: 'UG-0008', name: 'Утасны цэнэглэгч Type-C', category: 'Электроник', price: '19900.00', stockQty: 2, lowStockLimit: 5, unit: 'ш' }, // лимитээс доош
    { sku: 'UG-0009', name: 'Ургамлын тос 1л', category: 'Хүнс', price: '12500.00', stockQty: 25, lowStockLimit: 10, unit: 'ш' },
    { sku: 'UG-0010', name: 'Хог уут 20ш', category: 'Гэр ахуй', price: '5500.00', stockQty: 3, lowStockLimit: 10, unit: 'ш' }, // лимитээс доош
  ];

  // Эхний үлдэгдлийг үүсгэхдээ INITIAL хөдөлгөөн БИЧНЭ — эс тэгвэл
  // StockMovement-ийн нийлбэр бодит үлдэгдэлтэй хэзээ ч таарахгүй
  // (CSV импорт нь ингэж бичдэг тул түүнтэй нийцүүлэв).
  const admin = users.get('admin@ocirrf.mn');
  for (const p of products) {
    const categoryId = categories.get(p.category) ?? null;
    const skuWhere = {
      organizationId_sku: { organizationId: DEFAULT_ORG_ID, sku: p.sku },
    };
    const existed = await prisma.product.findUnique({ where: skuWhere });
    await prisma.product.upsert({
      where: skuWhere,
      // stockQty-г update-д ОРУУЛДАГГҮЙ: амьд үлдэгдлийг StockMovement
      // түүхгүйгээр дарж бичихээс сэргийлнэ (зөвхөн шинээр үүсэхэд тавигдана)
      update: {
        name: p.name,
        price: p.price,
        lowStockLimit: p.lowStockLimit,
        unit: p.unit,
        categoryId,
        isActive: true,
      },
      create: {
        sku: p.sku,
        name: p.name,
        price: p.price,
        stockQty: p.stockQty,
        lowStockLimit: p.lowStockLimit,
        unit: p.unit,
        categoryId,
        isActive: true,
        organizationId: DEFAULT_ORG_ID,
      },
    });
    if (!existed && p.stockQty > 0 && admin) {
      const created = await prisma.product.findUniqueOrThrow({
        where: skuWhere,
      });
      await prisma.stockMovement.create({
        data: {
          organizationId: DEFAULT_ORG_ID,
          productId: created.id,
          qtyChange: p.stockQty,
          reason: 'INITIAL',
          note: 'Seed — эхний үлдэгдэл',
          userId: admin,
        },
      });
    }
  }
}

async function main() {
  await seedOrganization();
  await seedApplications();
  const users = await seedUsers();
  await seedDriverProfile(users);
  const categories = await seedCategories();
  await seedProducts(categories, users);

  const [userCount, driverProfiles, cats, prods] = await Promise.all([
    prisma.user.count(),
    prisma.driverProfile.count(),
    prisma.category.count(),
    prisma.product.count(),
  ]);
  console.log(
    `Seed дууслаа: User ${userCount}, DriverProfile ${driverProfiles}, Category ${cats}, Product ${prods}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
