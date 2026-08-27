import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function seedUsers() {
  const users = [
    {
      username: 'admin@ursgal.mn',
      password: 'admin123',
      fullName: 'Систем Админ',
      role: 'ADMIN' as const,
    },
    {
      username: 'manager@ursgal.mn',
      password: 'manager123',
      fullName: 'Агуулахын Менежер',
      role: 'MANAGER' as const,
    },
    {
      username: 'operator@ursgal.mn',
      password: 'operator123',
      fullName: 'Туршилт Оператор',
      role: 'OPERATOR' as const,
    },
    {
      username: 'driver@ursgal.mn',
      password: 'driver123',
      fullName: 'Хүргэлтийн Жолооч',
      role: 'DRIVER' as const,
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
      },
    });
    byUsername.set(u.username, user.id);
  }
  return byUsername;
}

async function seedDriverProfile(users: Map<string, string>) {
  const driverId = users.get('driver@ursgal.mn');
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
      where: { name },
      update: {},
      create: { name },
    });
    byName.set(name, cat.id);
  }
  return byName;
}

async function seedProducts(categories: Map<string, string>) {
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

  for (const p of products) {
    const categoryId = categories.get(p.category) ?? null;
    await prisma.product.upsert({
      where: { sku: p.sku },
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
      },
    });
  }
}

/** Хүргэлтийн тарифын default-ууд (V4-05) — байхгүй үед л үүсгэнэ */
async function seedTariffs() {
  const count = await prisma.deliveryTariff.count();
  if (count > 0) return;
  await prisma.deliveryTariff.createMany({
    data: [
      { region: 'ULAANBAATAR', district: null, fee: 5000 },
      { region: 'ORON_NUTAG', district: null, fee: 15000 },
    ],
  });
}

async function main() {
  const users = await seedUsers();
  await seedDriverProfile(users);
  const categories = await seedCategories();
  await seedProducts(categories);
  await seedTariffs();

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
