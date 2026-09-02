// Тест ӨӨРИЙН DB дээр ажиллана — dev өгөгдлийг бохирдуулахгүй, тестийн
// таамаглал бодит өгөгдөлтэй зөрчилдөхгүй. Гараар өөр DB зааж болно.
// Бэлдэх: createdb ocirrf_test && DATABASE_URL=... prisma migrate deploy && prisma db seed
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://ursgal_user:ursgal123@localhost:5432/ocirrf_test?schema=public';

// e2e орчинд rate limit-ийг өндөр тавина — тестүүд login-ийг олон удаа дууддаг
process.env.AUTH_RATE_LIMIT = '100000';
// Тест нь богино хугацаанд олон зуун хүсэлт илгээдэг тул
// глобал хязгаарыг өндөрт тавина (V5)
process.env.GLOBAL_RATE_LIMIT = '100000';
