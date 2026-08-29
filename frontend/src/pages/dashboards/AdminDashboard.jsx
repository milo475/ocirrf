import BarMini from '../../components/dashboard/BarMini'
import MetricCard from '../../components/dashboard/MetricCard'
import RankList from '../../components/dashboard/RankList'
import Rise from '../../components/dashboard/Rise'
import { useLang } from '../../context/LanguageContext'
import { DashError, DashSkeleton } from '../../components/dashboard/DashStates'
import { useDashboard } from '../../hooks/useDashboard'
import { formatMoneyRound } from '../../lib/format'

export default function AdminDashboard() {
  const { t } = useLang()
  const { data, error, reload } = useDashboard('admin')

  if (error) return <DashError error={error} onRetry={reload} />
  if (!data) return <DashSkeleton />

  const created = data.last7Days.map((d) => d.ordersCreated)
  const delivered = data.last7Days.map((d) => d.delivered)
  const dayLabels = data.last7Days.map((d) => d.date.slice(8, 10))

  return (
    <div>
      <Rise delay={0}>
        <section className="flex items-end justify-between gap-4">
          <h1 className="font-serif text-4xl font-medium">
            {t('Удирдлагын самбар')}
          </h1>
          <p className="font-mono text-sm text-ink-muted tabular-nums">
            {t('Нийт хүргэлт')}: {data.deliveredTotal}
          </p>
        </section>
      </Rise>

      {/* MetricCard ×4 */}
      <Rise delay={60}>
        <section className="mt-16 border-t border-rule pt-8">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 md:divide-x divide-rule">
            {/* FinanceEntry-ийн INCOME нийлбэр (төлбөр + гар бүртгэл) */}
            <MetricCard
              label={t('Нийт орлого')}
              value={formatMoneyRound(data.totalIncome)}
            />
            {/* Борлуулалт − борлуулсан барааны өртөг (v4) */}
            <MetricCard
              label={t('Нийт ашиг')}
              value={formatMoneyRound(data.totalProfit)}
            />
            <MetricCard
              label={t('Нийт хүлээн авагч')}
              value={String(data.totalCustomers)}
            />
            <MetricCard
              label={t('Нийт жолооч')}
              value={String(data.totalDrivers)}
            />
            <MetricCard
              label={t('Хүргэлтэд гарсан')}
              value={String(data.deliveriesInProgress)}
            />
            <MetricCard
              label={t('Амжилттай хүргэсэн')}
              value={String(data.deliveredTotal)}
            />
          </div>
        </section>
      </Rise>

      {/* 7 хоногийн performance — хос багана */}
      <Rise delay={120}>
        <section className="mt-16 border-t border-rule pt-8">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
            <p className="text-xs uppercase tracking-wide text-ink-muted">
              {t('7 хоногийн гүйцэтгэл')}
            </p>
            <p className="flex items-center gap-4 text-xs text-ink-muted">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-accent inline-block" />
                {t('Үүсгэсэн захиалга')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-ink-muted inline-block" />
                {t('Хүргэсэн')}
              </span>
            </p>
          </div>
          <BarMini
            values={created}
            values2={delivered}
            width={480}
            height={90}
            labels={dayLabels}
          />
        </section>
      </Rise>

      {/* TOP-3 жолооч */}
      <Rise delay={180}>
        <section className="mt-16 border-t border-rule pt-8 max-w-xl">
          <p className="text-xs uppercase tracking-wide text-ink-muted mb-4">
            {t('Шилдэг жолооч TOP-3')}
          </p>
          <RankList
            items={data.topDrivers.map((d) => ({
              id: d.id,
              name: d.name,
              sub: `${t('хуваарилагдсан')} ${d.assigned} · ${t('хүргэсэн')} ${d.delivered}`,
              value: `DR ${Math.round(d.dr * 100)}%`,
            }))}
          />
        </section>
      </Rise>
    </div>
  )
}
