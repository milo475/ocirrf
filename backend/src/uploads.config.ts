import { join } from 'node:path';

/**
 * Хүргэлтийн баталгаажуулах зургийн хавтас.
 * Production-д .env-ийн UPLOADS_DIR-ээр өөр байршил (жишээ нь
 * /var/lib/ursgal/uploads) зааж өгч болно; заагаагүй бол backend/uploads.
 * (main.ts-ийн эхний мөр dotenv-ийг ачаалдаг тул энд env бэлэн байна.)
 */
export const UPLOADS_DIR =
  process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads');
