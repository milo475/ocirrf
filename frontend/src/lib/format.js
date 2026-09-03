/** LanguageContext тохируулдаг — сая/мянга эсвэл M/K гэж товчлохыг шийднэ */
let formatLang = 'mn'
export function setFormatLang(lang) {
  formatLang = lang
}

/**
 * Мөнгөн дүн товчоор: 48_200_000 → "₮48.2сая" (en: "₮48.2M").
 *
 * ЗАСВАР (V5): өмнө нь зөвхөн `>=` харьцуулалттай байсан тул СӨРӨГ дүн
 * товчлолгүй, түүхий хэвээр гардаг байв — `formatMoneyShort(-5000000)`
 * нь `"₮-5000000"` буцаадаг, Аналитик хуудсанд `+{...}` угтвартай, ногоон
 * өнгөөр «+₮-5000000» гэж харагддаг байсан. Одоо тэмдгийг тусад нь салгаж,
 * абсолют утгаар товчилно. NaN/null-д ₮0 буцаана (өмнө нь "NaN₮"/"₮null").
 */
export function formatMoneyShort(n) {
  const [mil, thou] = formatLang === 'en' ? ['M', 'K'] : ['сая', 'мянга']
  const v = Number(n)
  if (!Number.isFinite(v)) return '₮0'
  const sign = v < 0 ? '-' : ''
  const a = Math.abs(v)
  if (a >= 1_000_000) return `₮${sign}${(a / 1_000_000).toFixed(1)}${mil}`
  // 999_600 нь Math.round-оор 1000 болж «₮1000мянга» болдог байсан —
  // сая руу дэвшүүлнэ
  if (a >= 999_500) return `₮${sign}${(a / 1_000_000).toFixed(1)}${mil}`
  if (a >= 1_000) return `₮${sign}${Math.round(a / 1_000)}${thou}`
  return `₮${sign}${a}`
}

/** Огноо + цаг: "2026-08-25 14:30" */
export function formatDateTime(iso) {
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-CA')} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}

/**
 * Бүхэл дүн (мөнгөн тэмдэгттэй, аравтгүй): 1127700 → "1,127,700₮".
 * Самбар/картын том тоонд — ".00" нь 3 тэмдэгт эзэлж зайг дэмий иддэг,
 * төгрөгт бутархай ховор. Гүйлгээ/нэхэмжлэхэд formatMoney хэвээр.
 */
export function formatMoneyRound(n) {
  const v = Number(n)
  // Сервер талбар дутуу/нэр солигдвол «NaN₮» гэж чимээгүй гарахын оронд 0
  if (!Number.isFinite(v)) return '0₮'
  return `${Math.round(v).toLocaleString('en-US')}₮`
}

/** Бүтэн дүн: 12500 → "12,500.00₮" (Decimal 12,2-той нийцнэ) */
export function formatMoney(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0.00₮'
  return `${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₮`
}
