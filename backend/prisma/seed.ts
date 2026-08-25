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
      username: 'operator@ursgal.mn',
      password: 'operator123',
      fullName: 'Туршилт Оператор',
      role: 'OPERATOR' as const,
    },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { username: u.username },
      update: { fullName: u.fullName, role: u.role, isActive: true },
      create: {
        username: u.username,
        passwordHash,
        fullName: u.fullName,
        role: u.role,
      },
    });
  }
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
  // stockQty санаатайгаар янз бүр: 0 (дууссан), бага (2–8), дунд, их —
  // dashboard-ийн эрсдэлийн харагдацыг турших өгөгдөл.
  const products = [
    { sku: 'UG-0001', name: 'Цагаан будаа 5кг', category: 'Хүнс', price: '28500.00', stockQty: 120, unit: 'ш' },
    { sku: 'UG-0002', name: 'Сүү 1л', category: 'Хүнс', price: '4800.00', stockQty: 45, unit: 'ш' },
    { sku: 'UG-0003', name: 'Элсэн чихэр 1кг', category: 'Хүнс', price: '3900.00', stockQty: 8, unit: 'кг' },
    { sku: 'UG-0004', name: 'Гоймон 400г', category: 'Хүнс', price: '2500.00', stockQty: 0, unit: 'ш' },
    { sku: 'UG-0005', name: 'Аяга угаагч шингэн 500мл', category: 'Гэр ахуй', price: '7200.00', stockQty: 30, unit: 'ш' },
    { sku: 'UG-0006', name: 'Угаалгын нунтаг 3кг', category: 'Гэр ахуй', price: '24900.00', stockQty: 4, unit: 'ш' },
    { sku: 'UG-0007', name: 'LED чийдэн 9Вт', category: 'Электроник', price: '8500.00', stockQty: 60, unit: 'ш' },
    { sku: 'UG-0008', name: 'Утасны цэнэглэгч Type-C', category: 'Электроник', price: '19900.00', stockQty: 2, unit: 'ш' },
  ];

  for (const p of products) {
    const categoryId = categories.get(p.category) ?? null;
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {
        name: p.name,
        price: p.price,
        stockQty: p.stockQty,
        unit: p.unit,
        categoryId,
        isActive: true,
      },
      create: {
        sku: p.sku,
        name: p.name,
        price: p.price,
        stockQty: p.stockQty,
        unit: p.unit,
        categoryId,
        isActive: true,
      },
    });
  }
}

async function main() {
  await seedUsers();
  const categories = await seedCategories();
  await seedProducts(categories);

  const [users, cats, prods] = await Promise.all([
    prisma.user.count(),
    prisma.category.count(),
    prisma.product.count(),
  ]);
  console.log(`Seed дууслаа: User ${users}, Category ${cats}, Product ${prods}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
