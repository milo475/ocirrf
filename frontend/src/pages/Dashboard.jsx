import { useCallback, useEffect, useMemo, useState } from 'react'
import BeeswarmChart from '../components/dashboard/BeeswarmChart'
import CategoryFilter from '../components/dashboard/CategoryFilter'
import ProductDrawer from '../components/dashboard/ProductDrawer'
import Rise from '../components/dashboard/Rise'
import StatRow from '../components/dashboard/StatRow'
import ViewToggle from '../components/dashboard/ViewToggle'
import Watchlist from '../components/dashboard/Watchlist'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import { useLang } from '../context/LanguageContext'
import { api } from '../lib/api'
import { formatMoneyShort } from '../lib/format'
// Mock хэвээр үлдэнэ (туршилтад хэрэгтэй): '../data/mockStockHealth'

/** Package icon (lucide-ийн загвараар, инлайн SVG) */
function PackageIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-ink-muted shrink-0"
      aria-hidden="true"
    >
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  )
}

/** Ачаалж байх үеийн skeleton — хуудасны бүтцийг дуурайна */
function DashboardSkeleton() {
  return (
    <div className="animate-pulse motion-reduce:animate-none" aria-hidden="true">
      <div className="h-10 w-80 bg-surface rounded" />
      <div className="mt-16 border-t border-rule pt-8 grid grid-cols-2 md:grid-cols-4 gap-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i}>
            <div className="h-3 w-24 bg-surface rounded" />
            <div className="mt-3 h-8 w-28 bg-surface rounded" />
          </div>
        ))}
      </div>
      <div className="mt-16 border-t border-rule pt-8 h-48 bg-surface rounded" />
    </div>
  )
}

export default function Dashboard() {
  const { t } = useLang()
  const [view, setView] = useState('combined')
  const [filter, setFilter] = useState(null)
  const [selected, setSelected] = useState(null)

  // DASHBOARD.md Алхам 13: mock-ийн оронд бодит API
  const [products, setProducts] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    setError(null)
    setProducts(null)
    api('/dashboard/stock-health')
      .then(setProducts)
      .catch((e) => setError(e))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const totalSales = (products ?? []).reduce((a, p) => a + p.monthlySales, 0)
  const categories = useMemo(
    () => [...new Set((products ?? []).map((p) => p.category))],
    [products],
  )

  if (error) {
    return (
      <EmptyState
        title={t('Өгөгдөл ачаалж чадсангүй')}
        note={error.message}
        action={<Button onClick={load}>{t('Дахин оролдох')}</Button>}
      />
    )
  }

  if (!products) return <DashboardSkeleton />

  if (products.length === 0) {
    return (
      <EmptyState
        title={t('Бараа бүртгэгдээгүй байна')}
        note={t('Эхлээд бараагаа бүртгэж, үлдэгдэл оруулна уу')}
      />
    )
  }

  return (
    <div>
      {/* Алхам 2 — Header */}
      <Rise delay={0}>
        <section className="flex items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <PackageIcon />
            <h1 className="font-serif text-4xl font-medium">
              {t('Нөөцийн эрүүл мэнд')}
            </h1>
          </div>
          <p className="font-mono text-sm text-ink-muted tabular-nums">
            {products.length} {t('бараа')} / {formatMoneyShort(totalSales)}
          </p>
        </section>
      </Rise>

      {/* Алхам 6 — Stat row */}
      <Rise delay={60}>
        <section className="mt-16 border-t border-rule pt-8">
          <StatRow products={products} />
        </section>
      </Rise>

      {/* Алхам 7–9 — Beeswarm */}
      <Rise delay={120}>
        <section className="mt-16 border-t border-rule pt-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <ViewToggle value={view} onChange={setView} />
            <CategoryFilter
              categories={categories}
              value={filter}
              onChange={setFilter}
            />
          </div>
          <BeeswarmChart
            products={products}
            view={view}
            filter={filter}
            selectedId={selected?.id}
            onSelect={setSelected}
          />
        </section>
      </Rise>

      {/* Алхам 10 — Watchlist */}
      <Rise delay={180}>
        <section className="mt-16 border-t border-rule pt-8">
          <p className="text-xs uppercase tracking-wide text-ink-muted mb-4">
            {t('Хяналтын жагсаалт — хамгийн эрсдэлтэй 8')}
          </p>
          <Watchlist
            products={products}
            selectedId={selected?.id}
            onSelect={setSelected}
          />
        </section>
      </Rise>

      {/* Алхам 11 — Drawer */}
      <ProductDrawer product={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
