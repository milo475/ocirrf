import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import Badge, { STATUS_LABELS } from '../components/ui/Badge'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Input from '../components/ui/Input'
import Spinner from '../components/ui/Spinner'
import Table from '../components/ui/Table'
import { api } from '../lib/api'
import { formatDateTime, formatMoney } from '../lib/format'

const LIMIT = 20
const STATUS_TABS = ['', 'NEW', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED']

export default function Orders() {
  const navigate = useNavigate()

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const load = useCallback(() => {
    setError(null)
    const q = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
    if (search) q.set('search', search)
    if (status) q.set('status', status)
    api(`/orders?${q}`)
      .then(setData)
      .catch((e) => setError(e))
  }, [search, status, page])

  useEffect(() => {
    load()
  }, [load])

  const columns = [
    {
      key: 'orderNo',
      header: '№',
      render: (o) => <span className="font-mono">{o.orderNo}</span>,
    },
    { key: 'customerName', header: 'Харилцагч' },
    {
      key: 'phone',
      header: 'Утас',
      render: (o) => <span className="font-mono tabular-nums">{o.phone}</span>,
    },
    {
      key: 'totalAmount',
      header: 'Дүн',
      align: 'right',
      render: (o) => (
        <span className="font-mono tabular-nums">
          {formatMoney(o.totalAmount)}
        </span>
      ),
    },
    {
      key: 'orderStatus',
      header: 'Статус',
      render: (o) => <Badge status={o.orderStatus} />,
    },
    {
      key: 'createdAt',
      header: 'Огноо',
      render: (o) => (
        <span className="font-mono text-xs text-ink-muted tabular-nums">
          {formatDateTime(o.createdAt)}
        </span>
      ),
    },
    {
      key: 'createdBy',
      header: 'Үүсгэсэн',
      render: (o) => (
        <span className="text-ink-muted">{o.createdBy?.fullName ?? '—'}</span>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <h1 className="font-serif text-4xl font-medium">Захиалга</h1>
        <Button onClick={() => navigate('/orders/new')}>+ Шинэ захиалга</Button>
      </div>

      {/* Статусын tab-ууд */}
      <div className="mt-8 flex flex-wrap gap-1 border-b border-rule pb-3">
        {STATUS_TABS.map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => {
              setStatus(s)
              setPage(1)
            }}
            className={`px-3 py-1.5 rounded text-sm transition-colors ${
              status === s
                ? 'bg-surface text-ink'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {s ? STATUS_LABELS[s] : 'Бүгд'}
          </button>
        ))}
        <div className="ml-auto">
          <Input
            id="order-search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="№, нэр, утас…"
            className="w-56"
          />
        </div>
      </div>

      <div className="mt-6">
        {error ? (
          <EmptyState
            title="Жагсаалт ачаалж чадсангүй"
            note={error.message}
            action={<Button onClick={load}>Дахин оролдох</Button>}
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
            onRowClick={(o) => navigate(`/orders/${o.id}`)}
            empty="Захиалга олдсонгүй"
          />
        )}
      </div>
    </div>
  )
}
