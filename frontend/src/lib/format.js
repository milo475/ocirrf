/** Мөнгөн дүн товчоор: 48_200_000 → "₮48.2сая", 750_000 → "₮750мянга" */
export function formatMoneyShort(n) {
  if (n >= 1_000_000) return `₮${(n / 1_000_000).toFixed(1)}сая`
  if (n >= 1_000) return `₮${Math.round(n / 1_000)}мянга`
  return `₮${n}`
}

/** Бүтэн дүн: 12500 → "12,500.00₮" (Decimal 12,2-той нийцнэ) */
export function formatMoney(n) {
  return `${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}₮`
}
