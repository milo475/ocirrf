const DAY_MS = 24 * 60 * 60 * 1000;

/** `2026-08-28` — цаггүй, зөвхөн огноо */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `from`/`to` query параметрийг хугацааны мужид хөрвүүлнэ
 * (analytics болон reports нэг л дүрмээр ажиллана).
 *
 * ЯАГААД ТУСГАЙ ЗҮЙЛ ХЭРЭГТЭЙ ВЭ:
 * `new Date('2026-08-28')` нь ES-ийн дүрмээр UTC ШӨНӨ ДУНД болж хөрвөнө.
 * Тиймээс
 *   - `to=2026-08-28` → `2026-08-28T00:00Z` болж, тэр өдрийн бичлэгүүд
 *     БҮГД мужаас хасагдана (өдөр бүхэлдээ алдагдана);
 *   - `from=2026-08-01` → UB (UTC+8) цагаар 08:00 болж, тэр өдрийн
 *     эхний 8 цагийн бичлэг мужид ОРОХГҮЙ.
 *
 * Огноо зөвхөн (цаггүй) ирвэл ОРОН НУТГИЙН цагаар өдрийн эхлэл/төгсгөлд
 * тэлнэ. Бүтэн ISO (цагтай) ирвэл ямар нэг өөрчлөлтгүй хэвээр хүлээж авна.
 */
export function parseDateRange(
  from?: string,
  to?: string,
  defaultDays = 30,
): { start: Date; end: Date } {
  let start: Date;
  if (from) {
    start = new Date(DATE_ONLY.test(from) ? `${from}T00:00:00` : from);
  } else {
    start = new Date(Date.now() - (defaultDays - 1) * DAY_MS);
    start.setHours(0, 0, 0, 0);
  }

  const end = to
    ? new Date(DATE_ONLY.test(to) ? `${to}T23:59:59.999` : to)
    : new Date();

  return { start, end };
}
