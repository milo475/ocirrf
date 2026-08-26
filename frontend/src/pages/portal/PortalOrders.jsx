import { useCallback, useEffect, useState } from 'react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import { useLang } from '../../context/LanguageContext'
import { api } from '../../lib/api'
import { formatDateTime, formatMoney } from '../../lib/format'
import { StatusProgress } from './PortalHome'

const LIMIT = 10

/** Харилцагчийн бүх захиалга — дэлгэрэнгүй нь дараагийн шатанд өргөжнө */
export default function PortalOrders() {
  const { t } = useLang()

  const [data, setData] = useState(null)
  const [page, setPage] = useState(1)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    setError(null)
    api(`/portal/orders?page=${page}&limit=${LIMIT}`)
      .then(setData)
      .catch((e) => setError(e))
  }, [page])

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
  if (!data) {
    return (
      <div className="py-16 text-center">
        <Spinner size={22} />
      </div>
    )
  }

  const totalPages = Math.max(1, Math.ceil(data.total / LIMIT))

  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-4xl font-medium">
        {t('Миний захиалгууд')}
      </h1>

      {data.items.length === 0 ? (
        <div className="mt-8">
          <EmptyState title={t('Захиалга алга')} />
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {data.items.map((o) => (
            <div
              key={o.id}
              className="bg-surface border border-rule rounded-lg p-5"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono tabular-nums">{o.orderNo}</span>
                <Badge status={o.orderStatus} />
                <Badge status={o.deliveryStatus} />
                <span className="ml-auto font-mono text-lg tabular-nums">
                  {formatMoney(o.totalAmount)}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-ink-muted">{o.fullAddress}</p>
              <ul className="mt-3 border-t border-rule pt-3 space-y-1 text-sm">
                {o.items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-3">
                    <span className="truncate">{item.productName}</span>
                    <span className="font-mono tabular-nums shrink-0">
                      × {item.qty} · {formatMoney(item.lineTotal)}
                    </span>
                  </li>
                ))}
              </ul>
              {o.orderStatus !== 'CANCELLED' && (
                <div className="mt-4">
                  <StatusProgress status={o.orderStatus} t={t} />
                </div>
              )}
              {o.deliveryProofUrl && (
                <img
                  src={o.deliveryProofUrl}
                  alt={t('Баталгаажуулах зураг')}
                  className="mt-3 h-24 rounded border border-rule"
                />
              )}
              <p className="mt-3 font-mono text-xs text-ink-muted tabular-nums">
                {formatDateTime(o.createdAt)}
                {o.assignedDriver && ` · ${t('Жолооч')}: ${o.assignedDriver.fullName}`}
              </p>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-end gap-3 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="text-ink-muted hover:text-ink disabled:opacity-40"
          >
            ←
          </button>
          <span className="font-mono tabular-nums text-ink-muted">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="text-ink-muted hover:text-ink disabled:opacity-40"
          >
            →
          </button>
        </div>
      )}
    </div>
  )
}
