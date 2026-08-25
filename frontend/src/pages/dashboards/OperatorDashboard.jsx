import { useNavigate } from 'react-router'
import BarMini from '../../components/dashboard/BarMini'
import MetricCard from '../../components/dashboard/MetricCard'
import Rise from '../../components/dashboard/Rise'
import EmptyState from '../../components/ui/EmptyState'
import { useLang } from '../../context/LanguageContext'
import { mockOperatorDashboard as data } from '../../data/mockDashboards'
// API холбогдохоор дээрх мөр useOperatorDashboard() болж солигдоно (P21)

/** Үлдэгдлийн badge: 0 → улаан «Дууссан», лимитээс доош → шар тоо */
function LowStockBadge({ product, t }) {
  if (product.stockQty === 0) {
    return (
      <span className="inline-flex font-mono text-[11px] uppercase tracking-wide border rounded px-1.5 py-0.5 text-status-cancelled border-status-cancelled/40 bg-status-cancelled/12">
        {t('stock.out')}
      </span>
    )
  }
  return (
    <span className="font-mono tabular-nums text-status-preparing">
      {product.stockQty} / {product.lowStockLimit}
    </span>
  )
}

export default function OperatorDashboard() {
  const { t } = useLang()
  const navigate = useNavigate()

  const counts = data.last7Days.map((d) => d.count)
  const dayLabels = data.last7Days.map((d) => d.date.slice(8, 10))

  return (
    <div>
      <Rise delay={0}>
        <section>
          <h1 className="font-serif text-4xl font-medium">
            {t('Операторын самбар')}
          </h1>
        </section>
      </Rise>

      {/* MetricCard ×3 */}
      <Rise delay={60}>
        <section className="mt-16 border-t border-rule pt-8">
          <div className="grid grid-cols-3 md:divide-x divide-rule">
            <MetricCard
              label={t('Миний шивсэн захиалга')}
              value={String(data.myOrdersTotal)}
            />
            <MetricCard label={t('Биелсэн')} value={String(data.myDelivered)} />
            <MetricCard
              label="DR"
              value={`${Math.round(data.myDr * 100)}%`}
            />
          </div>
        </section>
      </Rise>

      {/* 7 хоногийн шивэлт */}
      <Rise delay={120}>
        <section className="mt-16 border-t border-rule pt-8">
          <p className="text-xs uppercase tracking-wide text-ink-muted mb-4">
            {t('7 хоногийн шивэлт')}
          </p>
          <BarMini values={counts} width={420} height={80} labels={dayLabels} />
        </section>
      </Rise>

      {/* Бага үлдэгдлийн анхааруулга */}
      <Rise delay={180}>
        <section className="mt-16 border-t border-rule pt-8 max-w-xl">
          <p className="text-xs uppercase tracking-wide text-ink-muted mb-4">
            {t('Бага үлдэгдэлтэй бараа')}
          </p>
          {data.lowStockProducts.length === 0 ? (
            <EmptyState
              title={t('Бүх үлдэгдэл хэвийн')}
              note={<span className="text-safe">✓</span>}
            />
          ) : (
            <ul className="divide-y divide-rule border-y border-rule">
              {data.lowStockProducts.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => navigate('/products')}
                    className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-surface transition-colors px-2 -mx-2"
                  >
                    <span className="flex-1 min-w-0 truncate">{p.name}</span>
                    <span className="font-mono text-xs text-ink-muted">
                      {p.sku}
                    </span>
                    <LowStockBadge product={p} t={t} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Rise>
    </div>
  )
}
