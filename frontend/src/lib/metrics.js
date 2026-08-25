/** Цэвэр тооцооллын функцууд — UI-гүй (DASHBOARD.md Алхам 4) */

/** Оргилоос одоо хүртэлх уналт, % */
export function drawdown(history) {
  const max = Math.max(...history)
  if (max <= 0) return 0
  return ((max - history[history.length - 1]) / max) * 100
}

/** Сүүлийн 2 долоо хоногийн зөрүү */
export function wowDelta(history) {
  return history[history.length - 1] - history[history.length - 2]
}

/**
 * Сүүлийн 6 утганд шулуун (least squares) ойролцоолж, 40-ийн шугамыг
 * огтлох хүртэлх долоо хоног. Налуу ≥ 0 бол Infinity (эрсдэлгүй),
 * аль хэдийн ≤40 бол 0.
 */
export function runwayWeeks(history) {
  const pts = history.slice(-6)
  const n = pts.length
  if (n < 2) return Infinity

  const xMean = (n - 1) / 2
  const yMean = pts.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (pts[i] - yMean)
    den += (i - xMean) ** 2
  }
  const slope = num / den

  if (slope >= 0) return Infinity
  const current = pts[n - 1]
  if (current <= 40) return 0
  return (current - 40) / -slope
}

/** Эрсдэлийн дүн: борлуулалт × (эрүүл биш хэсэг) + уналтын жин 1.4 */
export function exposure(p) {
  return (
    p.monthlySales * (1 - p.stockHealth / 100) +
    p.monthlySales * (drawdown(p.healthHistory) / 100) * 1.4
  )
}

export function daysSince(iso) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}
