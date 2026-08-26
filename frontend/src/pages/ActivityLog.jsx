import { useCallback, useEffect, useState } from 'react'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Input from '../components/ui/Input'
import Spinner from '../components/ui/Spinner'
import Table from '../components/ui/Table'
import { useLang } from '../context/LanguageContext'
import { api } from '../lib/api'
import { formatDateTime } from '../lib/format'

const LIMIT = 20

/** Entity-ийн монгол нэрс (interceptor controller нэрээс үүсгэдэг) */
const ENTITY_LABELS = {
  orders: 'Захиалга',
  products: 'Бараа',
  categories: 'Ангилал',
  stock: 'Агуулах',
  users: 'Хэрэглэгч',
  permissions: 'Эрхийн тохиргоо',
  delivery: 'Хүргэлт',
  finance: 'Санхүү',
  notifications: 'Мэдэгдэл',
}

function actionKind(action) {
  if (action === 'permission_change') return 'permission'
  if (action.startsWith('POST')) return 'create'
  if (action.startsWith('DELETE')) return 'delete'
  return 'update'
}

const ACTION_STYLE = {
  create: 'text-safe border-safe/40 bg-safe/12',
  update: 'text-accent border-accent/40 bg-accent/10',
  delete: 'text-alarm border-alarm/40 bg-alarm/10',
  permission: 'text-status-preparing border-status-preparing/40 bg-status-preparing/12',
}
const ACTION_LABEL = {
  create: 'action.create',
  update: 'action.update',
  delete: 'action.delete',
  permission: 'action.permission',
}

export default function ActivityLog() {
  const { t } = useLang()

  const [entity, setEntity] = useState('')
  const [userId, setUserId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [users, setUsers] = useState(null)
  const [error, setError] = useState(null)

  // Хэрэглэгчийн шүүлтүүр — users.manage байхгүй бол чимээгүй нуугдана
  useEffect(() => {
    api('/users')
      .then(setUsers)
      .catch(() => setUsers(null))
  }, [])

  const load = useCallback(() => {
    setError(null)
    const q = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
    if (entity) q.set('entity', entity)
    if (userId) q.set('userId', userId)
    if (from) q.set('from', new Date(from).toISOString())
    if (to) q.set('to', new Date(`${to}T23:59:59`).toISOString())
    api(`/activity-log?${q}`)
      .then(setData)
      .catch((e) => setError(e))
  }, [entity, userId, from, to, page])

  useEffect(() => {
    load()
  }, [load])

  const columns = [
    {
      key: 'createdAt',
      header: t('Огноо'),
      render: (r) => (
        <span className="font-mono text-xs text-ink-muted tabular-nums">
          {formatDateTime(r.createdAt)}
        </span>
      ),
    },
    { key: 'userName', header: t('Хэрэглэгч') },
    {
      key: 'action',
      header: t('Үйлдэл'),
      render: (r) => {
        const kind = actionKind(r.action)
        return (
          <span
            title={r.action}
            className={`inline-flex font-mono text-[10px] uppercase tracking-wide border rounded px-1 py-0.5 ${ACTION_STYLE[kind]}`}
          >
            {t(ACTION_LABEL[kind])}
          </span>
        )
      },
    },
    {
      key: 'entity',
      header: t('Объект'),
      render: (r) => (
        <span className="text-sm">
          {t(ENTITY_LABELS[r.entity] ?? r.entity)}
          {r.entityId && (
            <span className="font-mono text-[10px] text-ink-muted ml-1.5">
              {r.entityId.slice(0, 8)}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'meta',
      header: t('Дэлгэрэнгүй'),
      render: (r) =>
        r.meta ? (
          <details className="text-xs">
            <summary className="cursor-pointer text-ink-muted hover:text-ink select-none">
              JSON
            </summary>
            <pre className="mt-1 p-2 bg-bg border border-rule rounded font-mono text-[11px] max-w-xs overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(r.meta, null, 2)}
            </pre>
          </details>
        ) : (
          <span className="text-ink-muted">—</span>
        ),
    },
  ]

  return (
    <div>
      <h1 className="font-serif text-4xl font-medium">{t('Үйлдлийн түүх')}</h1>

      {/* Шүүлтүүрүүд */}
      <div className="mt-8 flex items-end gap-3 flex-wrap border-b border-rule pb-4">
        <label className="block">
          <span className="block text-xs uppercase tracking-wide text-ink-muted mb-1.5">
            {t('Объект')}
          </span>
          <select
            value={entity}
            onChange={(e) => {
              setEntity(e.target.value)
              setPage(1)
            }}
            className="bg-bg border border-rule rounded px-2 py-2 text-sm focus:outline-none focus:border-ink-muted"
          >
            <option value="">{t('Бүгд')}</option>
            {Object.entries(ENTITY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {t(label)}
              </option>
            ))}
          </select>
        </label>
        {users && (
          <label className="block">
            <span className="block text-xs uppercase tracking-wide text-ink-muted mb-1.5">
              {t('Хэрэглэгч')}
            </span>
            <select
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value)
                setPage(1)
              }}
              className="bg-bg border border-rule rounded px-2 py-2 text-sm focus:outline-none focus:border-ink-muted"
            >
              <option value="">{t('Бүгд')}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
            </select>
          </label>
        )}
        <Input
          id="al-from"
          label={t('Эхлэх')}
          type="date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value)
            setPage(1)
          }}
        />
        <Input
          id="al-to"
          label={t('Дуусах')}
          type="date"
          value={to}
          onChange={(e) => {
            setTo(e.target.value)
            setPage(1)
          }}
        />
      </div>

      <div className="mt-6">
        {error ? (
          <EmptyState
            title={t('Жагсаалт ачаалж чадсангүй')}
            note={error.message}
            action={<Button onClick={load}>{t('Дахин оролдох')}</Button>}
          />
        ) : !data ? (
          <div className="py-16 text-center">
            <Spinner size={22} />
          </div>
        ) : (
          <Table
            columns={columns}
            rows={data.items}
            page={data.page}
            limit={data.limit}
            total={data.total}
            onPageChange={setPage}
            empty={t('Бичилт олдсонгүй')}
          />
        )}
      </div>
    </div>
  )
}
