import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  markReadAndRefresh,
  notifTarget,
} from '../components/layout/NotificationBell'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import { api } from '../lib/api'
import { formatDateTime } from '../lib/format'

const LIMIT = 20

export default function Notifications() {
  const { t } = useLang()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [data, setData] = useState(null)
  const [page, setPage] = useState(1)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setError(null)
    api(`/notifications?page=${page}&limit=${LIMIT}`)
      .then(setData)
      .catch((e) => setError(e))
  }, [page])

  useEffect(() => {
    load()
  }, [load])

  async function readAll() {
    setBusy(true)
    try {
      await api('/notifications/read-all', { method: 'POST' })
      window.dispatchEvent(new Event('notif:refresh'))
      load()
    } finally {
      setBusy(false)
    }
  }

  function onPick(n) {
    void markReadAndRefresh(n)
    navigate(notifTarget(n, user?.role))
  }

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

  const hasUnread = data.items.some((n) => !n.isRead)
  const totalPages = Math.max(1, Math.ceil(data.total / LIMIT))

  return (
    <div className="max-w-2xl">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <h1 className="font-serif text-4xl font-medium">{t('Мэдэгдэл')}</h1>
        {hasUnread && (
          <Button variant="ghost" loading={busy} onClick={readAll}>
            {t('Бүгдийг уншсан болгох')}
          </Button>
        )}
      </div>

      {data.items.length === 0 ? (
        <div className="mt-8">
          <EmptyState title={t('Мэдэгдэл алга')} />
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-rule border-y border-rule">
          {data.items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => onPick(n)}
                className={`w-full text-left px-3 py-3 flex items-start gap-3 hover:bg-surface transition-colors ${
                  n.isRead ? '' : 'bg-accent/5'
                }`}
              >
                {!n.isRead && (
                  <span className="mt-2 w-2 h-2 rounded-full bg-accent shrink-0" />
                )}
                <span className="flex-1 min-w-0">
                  <span
                    className={`block ${n.isRead ? 'text-ink-muted' : 'font-medium'}`}
                  >
                    {n.title}
                  </span>
                  {n.body && (
                    <span className="block text-sm text-ink-muted mt-0.5">
                      {n.body}
                    </span>
                  )}
                </span>
                <span className="font-mono text-xs text-ink-muted tabular-nums shrink-0">
                  {formatDateTime(n.createdAt)}
                </span>
              </button>
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
