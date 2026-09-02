/**
 * САНХҮҮГИЙН АНГИЛЛЫН КАТАЛОГ (V5).
 *
 * Өмнө нь ангилал нь чөлөөт текст байв — frontend монголоор ('Түрээс'),
 * backend англиар ('DRIVER_PAYROLL') бичдэг. Тайлан бүлэглэхэд
 * тогтворгүй тул энд нэг эх сурвалж болгов: КОД нь DB-д хадгалагдана,
 * НЭР нь харагдана.
 *
 * ═══ `inPnl` ЯАГААД ХЭРЭГТЭЙ ВЭ ═══
 * Мөнгө гарсан бүхэн ЗАРДАЛ биш. Хоёр гүйлгээ мөнгөн урсгалд орох ч
 * Орлого тайланд ОРОХГҮЙ, эс тэгвэл тоо ХОЁР УДАА тоологдоно:
 *
 *   SUPPLY — нийлүүлэгчид төлсөн мөнгө нь БАРАА болж хувирдаг
 *            (хөрөнгө). Зарагдах үедээ л ЗБӨ болж зардалд орно.
 *            Хоёуланг нь тоовол өртөг давхарлана.
 *
 *   REFUND — буцаалт нь БОРЛУУЛАЛТААС аль хэдийн хасагддаг
 *            (finance.service-ийн salesRevenue буцаалтыг цэвэрлэдэг).
 *            Дахин зардал болговол хоёр дахин хасагдана.
 *
 * Мөн ОРЛОГЫН талд: PAYMENT нь мөнгө хүлээж авсны бүртгэл. Орлого
 * тайлангийн борлуулалт нь ЗАХИАЛГААС гардаг (төлсөн эсэхээс үл
 * хамааран), тиймээс PAYMENT-ыг дахин нэмбэл давхарлана.
 */

export type FinanceCategory = {
  /** Харагдах нэр */
  label: string;
  /** Орлого тайланд (P&L) орох эсэх — мөнгөн урсгалд бүгд ордог */
  inPnl: boolean;
  /** Систем өөрөө бичдэг эсэх — гараар сонгуулахгүй */
  auto: boolean;
};

export const INCOME_CATEGORIES: Record<string, FinanceCategory> = {
  PAYMENT: { label: 'Захиалгын төлбөр', inPnl: false, auto: true },
  /** Хуучин хувилбарын үлдэц — шинээр бичигдэхгүй ч өгөгдөлд бий */
  ORDER: { label: 'Захиалгын төлбөр', inPnl: false, auto: true },
  OTHER_INCOME: { label: 'Бусад орлого', inPnl: true, auto: false },
};

export const EXPENSE_CATEGORIES: Record<string, FinanceCategory> = {
  SUPPLY: { label: 'Бараа худалдан авалт', inPnl: false, auto: true },
  REFUND: { label: 'Үйлчлүүлэгчид буцаалт', inPnl: false, auto: true },
  DRIVER_PAYROLL: { label: 'Жолоочийн цалин', inPnl: true, auto: true },
  SALARY: { label: 'Ажилтны цалин', inPnl: true, auto: false },
  RENT: { label: 'Түрээс', inPnl: true, auto: false },
  PACKAGING: { label: 'Савлагаа, баглаа боодол', inPnl: true, auto: false },
  TRANSPORT: { label: 'Тээвэр, шатахуун', inPnl: true, auto: false },
  MARKETING: { label: 'Маркетинг, сурталчилгаа', inPnl: true, auto: false },
  UTILITIES: { label: 'Цахилгаан, ус, интернэт', inPnl: true, auto: false },
  BANK_FEE: { label: 'Банкны шимтгэл', inPnl: true, auto: false },
  TAX: { label: 'Татвар, хураамж', inPnl: true, auto: false },
  OTHER_EXPENSE: { label: 'Бусад зарлага', inPnl: true, auto: false },
};

/** Гараар бүртгэхэд сонгож болох ангиллууд */
export function manualCategories(type: 'INCOME' | 'EXPENSE') {
  const all = type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return Object.entries(all)
    .filter(([, c]) => !c.auto)
    .map(([code, c]) => ({ code, label: c.label }));
}

/**
 * Ангилал тайланд орох эсэх.
 *
 * Танихгүй код ирвэл (хуучин чөлөөт текст, жишээ нь 'Түрээс')
 * тайланд ОРУУЛНА — нягтлан бодит зардлаа алдахаас илүү үл
 * танигдсан мөр харсан нь дээр.
 */
export function countsInPnl(type: 'INCOME' | 'EXPENSE', code: string): boolean {
  const all = type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const known = all[code];
  if (known) return known.inPnl;
  // Танигдаагүй ОРЛОГЫН мөрийг тайланд оруулбал борлуулалттай
  // давхарлаж мэдэх тул зөвхөн ЗАРДЛЫГ оруулна.
  return type === 'EXPENSE';
}

/** DB-д байгаа код → харагдах нэр (танихгүй бол кодоо буцаана) */
export function categoryLabel(type: 'INCOME' | 'EXPENSE', code: string): string {
  const all = type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return all[code]?.label ?? code;
}
