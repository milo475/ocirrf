import { useLayoutEffect, useRef, useState } from 'react'

/**
 * Нэг статистик карт: жижиг uppercase гарчиг, том mono тоо, delta мөр.
 * delta.direction: 'worse' → alarm, 'better' → safe, бусад нь muted.
 */

const MAX_PX = 30 // богино тоо — text-3xl шиг том
const MIN_PX = 12
const CHAR_EM = 0.62 // IBM Plex Mono-ийн нэг тэмдэгтийн ойролцоо өргөн
const PAD_PX = 8 // ирмэгт тулгахгүй нөөц зай (хэмжилтийн алдааны даац)

/**
 * Тоог КАРТЫН БОДИТ ӨРГӨНД багтаах фонтын хэмжээг тооцно.
 *
 * Тогтмол `text-3xl` үед мөнгөн дүн урт болох тусам хөрш багана руу
 * халж, тоонууд давхцаж харагддаг байсан. Урт дээр суурилсан
 * шатлал ч хангалтгүй — ижил урттай тоо самбарын 6 багана, Санхүүгийн
 * 3 багана дээр өөр өөр өргөнтэй байрлана. Тиймээс ResizeObserver-оор
 * картын өргөнийг хэмжиж, `өргөн ÷ (тэмдэгтийн тоо × 0.62)` томьёогоор
 * хэмжээг сонгоно: тоо ХЭЗЭЭ Ч таслагдахгүй, богино тоо том хэвээр.
 */
function useFitFont(text) {
  const ref = useRef(null)
  const [size, setSize] = useState(MAX_PX)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // Фонт нь блок элементийн өргөнд нөлөөлөхгүй тул давталт үүсэхгүй
    const fit = () => {
      const w = el.clientWidth
      if (!w) return
      const ideal = (w - PAD_PX) / (Math.max(text.length, 1) * CHAR_EM)
      setSize(Math.max(MIN_PX, Math.min(MAX_PX, Math.floor(ideal))))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    // Вэб-фонт ачаалагдаж дуустал өргөн өөрчлөгдөж болно
    document.fonts?.ready.then(fit).catch(() => {})
    return () => ro.disconnect()
  }, [text])

  return [ref, size]
}

export default function MetricCard({ label, value, delta, sub }) {
  const deltaColor =
    delta?.direction === 'worse'
      ? 'text-alarm'
      : delta?.direction === 'better'
        ? 'text-safe'
        : 'text-ink-muted'
  const text = String(value ?? '')
  const [valueRef, fontSize] = useFitFont(text)

  return (
    // min-w-0 — grid/flex item-ийн default `min-width:auto` нь агуулгаараа
    // тэлж хөршөө шахдаг тул заавал хэрэгтэй
    <div className="min-w-0 px-3 sm:px-4 first:pl-0 last:pr-0">
      <p className="text-xs uppercase tracking-wide text-ink-muted truncate">
        {label}
      </p>
      <p
        ref={valueRef}
        title={text}
        style={{ fontSize: `${fontSize}px` }}
        className="mt-2 font-mono tabular-nums leading-tight whitespace-nowrap truncate"
      >
        {text}
      </p>
      {delta && (
        <p
          className={`mt-1 font-mono text-sm tabular-nums truncate ${deltaColor}`}
        >
          {delta.text}
        </p>
      )}
      {sub && <p className="mt-1 text-sm text-ink-muted truncate">{sub}</p>}
    </div>
  )
}
