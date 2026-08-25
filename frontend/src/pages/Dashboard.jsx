import { useMemo, useState } from 'react'
import BeeswarmChart from '../components/dashboard/BeeswarmChart'
import CategoryFilter from '../components/dashboard/CategoryFilter'
import ProductDrawer from '../components/dashboard/ProductDrawer'
import Rise from '../components/dashboard/Rise'
import StatRow from '../components/dashboard/StatRow'
import ViewToggle from '../components/dashboard/ViewToggle'
import Watchlist from '../components/dashboard/Watchlist'
import { products } from '../data/mockStockHealth'
import { formatMoneyShort } from '../lib/format'

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

export default function Dashboard() {
  const [view, setView] = useState('combined')
  const [filter, setFilter] = useState(null)
  const [selected, setSelected] = useState(null)

  const totalSales = products.reduce((a, p) => a + p.monthlySales, 0)
  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category))],
    [],
  )

  return (
    <div>
      {/* Алхам 2 — Header */}
      <Rise delay={0}>
        <section className="flex items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <PackageIcon />
            <h1 className="font-serif text-4xl font-medium">
              Нөөцийн эрүүл мэнд
            </h1>
          </div>
          <p className="font-mono text-sm text-ink-muted tabular-nums">
            {products.length} бараа / {formatMoneyShort(totalSales)}
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
            Хяналтын жагсаалт — хамгийн эрсдэлтэй 8
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
