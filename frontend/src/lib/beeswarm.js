/**
 * Beeswarm-ийн мөргөлдөөнгүй байрлал (DASHBOARD.md Алхам 8).
 * Цэвэр функц: оролт items + масштабын функцууд, гаралт {data, x, y, r}[].
 *
 * Хэрэгжилт: детерминист "dodge" — дугуй бүр ЯГ өөрийн x дээрээ үлдэж,
 * зөвхөн y тэнхлэгээр төвөөс хамгийн ойр чөлөөт байрлалыг авна.
 * (d3-force-ийн collide нь нягт бөөгнөрөлд x-ийг 8px хүртэл түлхэж
 * "x байрлал оноогоо хадгална (±2px)" гэсэн батлах шалгуурыг хангадаггүй
 * тул энэ аргыг сонгосон. Гаралт бүрэн детерминист — тест хийхэд хялбар.)
 */
export function computeBeeswarm(items, { xOf, rOf, padding = 1 }) {
  const nodes = items
    .map((d) => ({ data: d, x: xOf(d), y: 0, r: rOf(d) }))
    .sort((a, b) => a.x - b.x)

  const placed = []
  for (const n of nodes) {
    // Боломжит y: төв (0) болон аль хэдийн тавигдсан, хэвтээгээр давхцаж
    // болзошгүй дугуй бүрийн дээд/доод шүргэх цэгүүд
    const candidates = [0]
    for (const p of placed) {
      const dx = n.x - p.x
      const rr = n.r + p.r + padding
      if (Math.abs(dx) < rr) {
        const dy = Math.sqrt(rr * rr - dx * dx)
        candidates.push(p.y + dy, p.y - dy)
      }
    }

    candidates.sort((a, b) => Math.abs(a) - Math.abs(b))
    n.y = candidates.find((c) =>
      placed.every((p) => {
        const dx = n.x - p.x
        const dy = c - p.y
        const rr = n.r + p.r + padding - 1e-6
        return dx * dx + dy * dy >= rr * rr
      }),
    ) ?? 0

    placed.push(n)
  }

  return nodes
}

/** Оноог өнгөнд буулгана: ≥55 ink, ≤45 alarm, хооронд нь oklch шилжилт */
export function healthColor(health) {
  if (health >= 55) return 'var(--color-ink)'
  if (health <= 45) return 'var(--color-alarm)'
  const t = Math.round(((health - 45) / 10) * 100)
  return `color-mix(in oklch, var(--color-ink) ${t}%, var(--color-alarm))`
}
