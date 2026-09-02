import { Prisma } from '../generated/prisma/client';

/** Transaction доторх Prisma client (bare client-ээс $transaction-гүй). */
type Tx = Prisma.TransactionClient;

/**
 * Барааны үлдэгдэл хөдлөхөд ЦУВРАЛУУДЫГ дагуулж хөдөлгөнө.
 *
 * ЗАРЧИМ — FEFO (First-Expired-First-Out):
 * Хугацаа эхэлж дуусах цувралыг эхэлж гаргана. Хүнсний нэмэлт
 * бүтээгдэхүүнд энэ нь заавал: сүүлд ирсэн шинэ барааг эхэлж зарвал
 * хуучин нь тавиур дээр хугацаагаа дуусгана.
 *
 * ЯАГААД ЗӨӨЛӨН (алдаа шидэхгүй):
 * Цуврал нь СОНГОЛТТОЙ. Хугацаагүй бараа, эсвэл цуврал бүртгэж
 * эхлэхээс өмнөх хуучин үлдэгдэлд цуврал байхгүй. Тийм үед энэ
 * функц юу ч хийхгүй өнгөрөх ба Product.stockQty өмнөх шигээ
 * ганцаараа ажиллана. Цуврал нь үлдэгдлийг ХУГАЦААГААР задалж
 * харуулах давхарга болохоос үлдэгдлийн эх сурвалж БИШ.
 *
 * @param delta сөрөг = бараа гарсан, эерэг = бараа буцаж ирсэн
 */
export async function applyBatchDelta(
  tx: Tx,
  productId: string,
  delta: number,
): Promise<void> {
  if (delta === 0) return;

  if (delta < 0) {
    // ГАРАЛТ — хугацаа эхэлж дуусахаас нь эхэлж хасна.
    let left = -delta;
    const open = await tx.productBatch.findMany({
      where: { productId, writtenOffAt: null, remaining: { gt: 0 } },
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
    });
    for (const b of open) {
      if (left <= 0) break;
      const take = Math.min(left, b.remaining);
      await tx.productBatch.update({
        where: { id: b.id },
        data: { remaining: b.remaining - take },
      });
      left -= take;
    }
    // `left > 0` үлдвэл цувралгүй үлдэгдлээс гарсан гэсэн үг — хэвийн.
    return;
  }

  // БУЦАЛТ (цуцлалт, буцаалт, залруулга) — FEFO-гийн ЯГ УРВУУ:
  // эхэлж дуусахаас нь хассан тул эхэлж дуусах руу нь буцаана.
  let back = delta;
  const used = await tx.productBatch.findMany({
    where: { productId, writtenOffAt: null },
    orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
  });
  for (const b of used) {
    if (back <= 0) break;
    const room = b.qty - b.remaining; // хэдийг нь хассан бэ
    if (room <= 0) continue;
    const put = Math.min(back, room);
    await tx.productBatch.update({
      where: { id: b.id },
      data: { remaining: b.remaining + put },
    });
    back -= put;
  }
  // `back > 0` үлдвэл цувралгүй үлдэгдэл рүү буцсан — хэвийн.
}

/** Хугацааны төлөв — өнгө ба эрэмбэ нь UI-д ижил утгатай байхын тулд. */
export type ExpiryState = 'EXPIRED' | 'CRITICAL' | 'WARNING' | 'OK';

/**
 * Дуусах хугацаанаас төлөв тооцно.
 *
 * `warnDays` нь тохиргооноос ирнэ (үндсэн 30) — компани «дуусахаас
 * 30 хоногийн өмнө устгалд гаргана» гэсэн дүрэмтэй.
 */
export function expiryState(expiry: Date, warnDays: number, now = new Date()): ExpiryState {
  const days = daysUntil(expiry, now);
  if (days < 0) return 'EXPIRED';
  if (days <= warnDays) return 'CRITICAL';
  if (days <= warnDays * 3) return 'WARNING';
  return 'OK';
}

/** Өнөөдрөөс хэдэн хоногийн дараа дуусах вэ (өнгөрсөн бол сөрөг). */
export function daysUntil(expiry: Date, now = new Date()): number {
  const a = Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth(), expiry.getUTCDate());
  const b = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((a - b) / 86_400_000);
}
