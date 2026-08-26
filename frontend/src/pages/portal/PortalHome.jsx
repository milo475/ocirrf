import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import { useLang } from '../../context/LanguageContext'
import { api } from '../../lib/api'
import { formatDateTime, formatMoney } from '../../lib/format'

/** Статусын явцын 5 цэг: Шинэ → Хүргэгдсэн */
const STEPS = [
  { key: 'NEW', label: 'Шинэ' },
  { key: 'CONFIRMED', label: 'Баталгаажсан' },
  { key: 'PREPARING', label: 'Бэлтгэж буй' },
  { key: 'READY', label: 'Бэлэн' },
  { key: 'COMPLETED', label: 'Хүргэгдсэн' },
]

export function StatusProgress({ status, t }) {
  if (status === 'CANCELLED') {
    return <Badge status="CANCELLED" />
  }
  const idx = STEPS.findIndex((s) => s.key === status)
  return (
    <div>
      <div className="flex items-center">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center flex-1 last:flex-none">
            <span
              className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${
                i < idx
                  ? 'bg-accent border-accent'
                  : i === idx
                    ? 'border-accent bg-accent/30'
                    : 'border-rule'
              }`}
            />
            {i < STEPS.length - 1 && (
              <span
                className={`h-0.5 flex-1 ${i < idx ? 'bg-accent' : 'bg-rule'}`}
              />
            )}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-ink-muted">
        <span>{t(STEPS[0].label)}</span>
        <span className="text-accent font-medium">
          {t(STEPS[idx]?.label ?? status)}
        </span>
        <span>{t(STEPS[4].label)}</span>
      </div>
    </div>
  )
}

export default function PortalHome() {
  const { t } = useLang()
  const navigate = useNavigate()

  const [dash, setDash] = useState(null)
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    setError(null)
    api('/portal/dashboard').then(setDash).catch((e) => setError(e))
    api('/portal/orders?limit=10')
      .then((d) => setOrders(d.items))
      .catch((e) => setError(e))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (error) {
    return (
      <EmptyState
        title={t('Өгөгдөл ачаалж чадсангүй')}
        note={error.message}
        action={<Button onClick={load}>{t('Дахин оролдох')}</Button>}
      />
    )
  }
  if (!dash || !orders) {
    return (
      <div className="py-16 text-center">
        <Spinner size={22} />
      </div>
    )
  }

  const active = orders.filter(
    (o) => !['COMPLETED', 'CANCELLED'].includes(o.orderStatus),
  )

  return (
    <div className="max-w-2xl">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-4xl font-medium">
            {t('Миний самбар')}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t('Нийт {n} захиалга · {m} идэвхтэй', {
              n: dash.totalOrders,
              m: dash.activeOrders,
            })}
          </p>
        </div>
        <Button
          onClick={() => navigate('/portal/new')}
          className="px-8 py-3 text-base"
        >
          {t('+ Шинэ захиалга')}
        </Button>
      </div>

      {/* Идэвхтэй захиалгууд — явцын зураастай том картууд */}
      {active.length > 0 && (
        <section className="mt-8 space-y-4">
          {active.map((o) => (
            <Link
              key={o.id}
              to="/portal/orders"
              className="block bg-surface border border-accent/40 rounded-lg p-5 hover:border-accent transition-colors"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono tabular-nums">{o.orderNo}</span>
                <span className="font-mono text-lg tabular-nums">
                  {formatMoney(o.totalAmount)}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink-muted truncate">
                {o.fullAddress}
              </p>
              <div className="mt-4">
                <StatusProgress status={o.orderStatus} t={t} />
              </div>
            </Link>
          ))}
        </section>
      )}

      {/* Сүүлийн захиалгууд */}
      <section className="mt-10 border-t border-rule pt-6">
        <p className="text-xs uppercase tracking-wide text-ink-muted mb-3">
          {t('Сүүлийн захиалгууд')}
        </p>
        {dash.recentOrders.length === 0 ? (
          <EmptyState
            title={t('Захиалга алга')}
            note={t('Эхний захиалгаа өгөөрэй!')}
            action={
              <Button onClick={() => navigate('/portal/new')}>
                {t('+ Шинэ захиалга')}
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-rule border-y border-rule">
            {dash.recentOrders.map((o) => (
              <li
                key={o.id}
                className="py-3 flex items-center gap-3 flex-wrap"
              >
                <span className="font-mono text-sm tabular-nums">
                  {o.orderNo}
                </span>
                <Badge status={o.orderStatus} />
                <span className="ml-auto font-mono text-sm tabular-nums">
                  {formatMoney(o.totalAmount)}
                </span>
                <span className="font-mono text-xs text-ink-muted tabular-nums">
                  {formatDateTime(o.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
