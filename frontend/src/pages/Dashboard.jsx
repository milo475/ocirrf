import Sparkline from '../components/dashboard/Sparkline'
import StatRow from '../components/dashboard/StatRow'
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
  const totalSales = products.reduce((a, p) => a + p.monthlySales, 0)

  return (
    <div>
      {/* Алхам 2 — Header */}
      <section className="flex items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <PackageIcon />
          <h1 className="font-serif text-4xl font-medium">Нөөцийн эрүүл мэнд</h1>
        </div>
        <p className="font-mono text-sm text-ink-muted tabular-nums">
          {products.length} бараа / {formatMoneyShort(totalSales)}
        </p>
      </section>

      {/* Алхам 6 — Stat row */}
      <section className="mt-16 border-t border-rule pt-8">
        <StatRow products={products} />
      </section>

      {/* Алхам 5-ын батлах хэсэг — sparkline-ууд өгөгдөлтэйгээ таарч буйг
          нүдээр шалгах түр зурвас. Алхам 7 (beeswarm) орохоор солигдоно. */}
      <section className="mt-16 border-t border-rule pt-8">
        <p className="text-xs uppercase tracking-wide text-ink-muted mb-4">
          13 долоо хоногийн трэнд (түр — beeswarm-аар солигдоно)
        </p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-4">
          {products.slice(0, 10).map((p) => (
            <div key={p.id} className="flex items-center gap-2 min-w-0">
              <Sparkline values={p.healthHistory} />
              <span className="text-xs text-ink-muted truncate">
                {p.name}
                <span className="font-mono ml-1">{p.stockHealth}</span>
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
