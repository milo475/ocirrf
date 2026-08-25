import { useNavigate } from 'react-router'
import BarMini from '../../components/dashboard/BarMini'
import Rise from '../../components/dashboard/Rise'
import Badge from '../../components/ui/Badge'
import { useLang } from '../../context/LanguageContext'
import { DashError, DashSkeleton } from '../../components/dashboard/DashStates'
import { useDashboard } from '../../hooks/useDashboard'
import { formatMoney } from '../../lib/format'

export default function ManagerDashboard() {
  const { t } = useLang()
  const navigate = useNavigate()
  const { data, error, reload } = useDashboard('manager')

  if (error) return <DashError error={error} onRetry={reload} />
  if (!data) return <DashSkeleton />

  const inValues = data.stockLast7Days.map((d) => d.in)
  const outValues = data.stockLast7Days.map((d) => d.out)
  const dayLabels = data.stockLast7Days.map((d) => d.date.slice(8, 10))

  return (
    <div>
      <Rise delay={0}>
        <section>
          <h1 className="font-serif text-4xl font-medium">
            {t('Менежерийн самбар')}
          </h1>
        </section>
      </Rise>

      {/* Орлого/зарлага — in ногоон, out улаан */}
      <Rise delay={60}>
        <section className="mt-16 border-t border-rule pt-8">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
            <p className="text-xs uppercase tracking-wide text-ink-muted">
              {t('Орлого / зарлага (7 хоног)')}
            </p>
            <p className="flex items-center gap-4 text-xs text-ink-muted">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-safe inline-block" />
                {t('Орлого')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-alarm inline-block" />
                {t('Зарлага')}
              </span>
            </p>
          </div>
          <BarMini
            values={inValues}
            values2={outValues}
            width={480}
            height={90}
            labels={dayLabels}
            color="var(--color-safe)"
            color2="var(--color-alarm)"
          />
        </section>
      </Rise>

      {/* Хуваарилалт хүлээж буй захиалгууд */}
      <Rise delay={120}>
        <section className="mt-16 border-t border-rule pt-8">
          <p className="text-xs uppercase tracking-wide text-ink-muted mb-4">
            {t('Хуваарилалт хүлээж буй')} — {data.awaitingAssignment.length}
          </p>
          {data.awaitingAssignment.length === 0 ? (
            <p className="text-sm text-ink-muted">—</p>
          ) : (
            <ul className="divide-y divide-rule border-y border-rule max-w-2xl">
              {data.awaitingAssignment.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/orders/${o.id}`)}
                    className="w-full flex items-center gap-3 py-3 text-left hover:bg-surface transition-colors px-2 -mx-2"
                  >
                    <span className="font-mono text-sm shrink-0">{o.orderNo}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate">{o.customerName}</span>
                      <span className="block text-xs text-ink-muted truncate">
                        {o.address}
                      </span>
                    </span>
                    <Badge status={o.orderStatus} />
                    <span className="font-mono text-sm tabular-nums shrink-0">
                      {formatMoney(o.totalAmount)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Rise>

      {/* Жолоочдын ачаалал */}
      <Rise delay={180}>
        <section className="mt-16 border-t border-rule pt-8 max-w-xl">
          <p className="text-xs uppercase tracking-wide text-ink-muted mb-4">
            {t('Жолоочдын ачаалал')}
          </p>
          <ul className="divide-y divide-rule">
            {data.driverLoad.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2.5">
                <span
                  title={d.isAvailable ? t('Чөлөөтэй') : t('Завгүй')}
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    d.isAvailable ? 'bg-safe' : 'bg-rule'
                  }`}
                />
                <span className="flex-1 truncate">{d.name}</span>
                <span className="font-mono text-sm tabular-nums">
                  {d.active}{' '}
                  <span className="text-ink-muted text-xs">
                    {t('идэвхтэй хүргэлт')}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </Rise>
    </div>
  )
}
