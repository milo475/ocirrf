import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import { useLang } from '../../context/LanguageContext'
import { api } from '../../lib/api'
import { formatDateTime, formatMoney } from '../../lib/format'

const LIMIT = 15

/** Харилцагчийн захиалгын жагсаалт — мөр дарвал tracking дэлгэрэнгүй */
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
        <ul className="mt-8 divide-y divide-rule border-y border-rule">
          {data.items.map((o) => (
            <li key={o.id}>
              <Link
                to={`/portal/orders/${o.id}`}
                className="flex items-center gap-3 py-3 px-2 -mx-2 hover:bg-surface transition-colors flex-wrap"
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
              </Link>
            </li>
          ))}
        </ul>
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
