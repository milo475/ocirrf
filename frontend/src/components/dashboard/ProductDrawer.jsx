import { useEffect, useState } from 'react'
import { formatMoneyShort } from '../../lib/format'
import { daysSince } from '../../lib/metrics'
import Sparkline from './Sparkline'
import Waterfall from './Waterfall'

const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-CA')

function InfoRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-rule last:border-0">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="font-mono text-sm tabular-nums text-right">{value}</dd>
    </div>
  )
}

/** Баруун талаас гулсаж гарах дэлгэрэнгүй самбар (DASHBOARD.md Алхам 11) */
export default function ProductDrawer({ product, onClose }) {
  const [shown, setShown] = useState(false)

  // Гарч ирэх шилжилт: mount дараа нэг frame-ийн дараа идэвхжүүлнэ
  useEffect(() => {
    if (!product) {
      setShown(false)
      return
    }
    const id = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(id)
  }, [product])

  // Escape дарахад хаагдана
  useEffect(() => {
    if (!product) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [product, onClose])

  if (!product) return null

  return (
    <div className="fixed inset-0 z-40">
      {/* Гадна дарахад хаагдана */}
      <button
        type="button"
        aria-label="Хаах"
        onClick={onClose}
        className={`absolute inset-0 w-full bg-bg transition-opacity duration-300 motion-reduce:transition-none ${
          shown ? 'opacity-60' : 'opacity-0'
        }`}
      />

      <aside
        className={`absolute right-0 top-0 h-full w-[420px] max-w-[90vw] bg-surface border-l border-rule overflow-y-auto transition-transform duration-300 motion-reduce:transition-none ${
          shown ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-2xl font-medium leading-tight">
                {product.name}
              </h2>
              <p className="font-mono text-xs text-ink-muted mt-1">
                {product.sku} · {product.category}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-ink-muted hover:text-ink text-xl leading-none px-1"
              aria-label="Хаах"
            >
              ×
            </button>
          </div>

          <section className="mt-8">
            <p className="text-xs uppercase tracking-wide text-ink-muted mb-3">
              Онооны задаргаа
            </p>
            <Waterfall
              drivers={product.drivers}
              stockHealth={product.stockHealth}
            />
          </section>

          <section className="mt-8">
            <p className="text-xs uppercase tracking-wide text-ink-muted mb-3">
              13 долоо хоногийн хандлага
            </p>
            <Sparkline values={product.healthHistory} width={380} height={64} />
          </section>

          <section className="mt-8">
            <dl>
              <InfoRow label="Нийлүүлэгч" value={product.supplier} />
              <InfoRow
                label="Үлдэгдэл / захиалгын түвшин"
                value={`${product.stockQty} / ${product.reorderLevel}`}
              />
              <InfoRow
                label="Сарын борлуулалт"
                value={formatMoneyShort(product.monthlySales)}
              />
              <InfoRow
                label="Эргэц"
                value={
                  product.turnoverRate === null
                    ? '—'
                    : `${Math.round(product.turnoverRate * 100)}%`
                }
              />
              <InfoRow
                label="Сүүлд нөхсөн"
                value={`${fmtDate(product.lastRestocked)} (${daysSince(product.lastRestocked)} хоног)`}
              />
              <InfoRow
                label="Дараагийн нөхөлт"
                value={fmtDate(product.nextRestockDate)}
              />
            </dl>
          </section>
        </div>
      </aside>
    </div>
  )
}
