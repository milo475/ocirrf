/** LanguageContext тохируулдаг — сая/мянга эсвэл M/K гэж товчлохыг шийднэ */
let formatLang = 'mn'
export function setFormatLang(lang) {
  formatLang = lang
}

/** Мөнгөн дүн товчоор: 48_200_000 → "₮48.2сая" (en: "₮48.2M") */
export function formatMoneyShort(n) {
  const [mil, thou] = formatLang === 'en' ? ['M', 'K'] : ['сая', 'мянга']
  if (n >= 1_000_000) return `₮${(n / 1_000_000).toFixed(1)}${mil}`
  if (n >= 1_000) return `₮${Math.round(n / 1_000)}${thou}`
  return `₮${n}`
}

/** Огноо + цаг: "2026-08-25 14:30" */
export function formatDateTime(iso) {
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-CA')} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}

/** Бүтэн дүн: 12500 → "12,500.00₮" (Decimal 12,2-той нийцнэ) */
export function formatMoney(n) {
  return `${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₮`
}
