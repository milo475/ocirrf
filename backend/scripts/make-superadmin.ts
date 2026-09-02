import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

/**
 * Хэрэглэгчийг ПЛАТФОРМЫН SUPERADMIN болгоно (эсвэл болиулна).
 *
 * Хэрэглээ:
 *   npx tsx scripts/make-superadmin.ts admin@ocirrf.mn
 *   npx tsx scripts/make-superadmin.ts admin@ocirrf.mn --revoke
 *
 * Docker дотор:
 *   docker compose exec app npx tsx scripts/make-superadmin.ts <email>
 */
const email = process.argv[2];
const revoke = process.argv.includes('--revoke');

if (!email) {
  console.error('Хэрэглээ: npx tsx scripts/make-superadmin.ts <email> [--revoke]');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const user = await prisma.user.findUnique({ where: { username: email } });
  if (!user) {
    console.error(`Хэрэглэгч олдсонгүй: ${email}`);
    process.exitCode = 1;
    return;
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { isSuperAdmin: !revoke },
  });
  console.log(
    revoke
      ? `SUPERADMIN эрх ХАСАГДЛАА: ${email}`
      : `SUPERADMIN боллоо: ${email} (${user.fullName})`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
