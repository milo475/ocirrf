import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import Badge, { STATUS_LABELS } from '../components/ui/Badge'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Input from '../components/ui/Input'
import Spinner from '../components/ui/Spinner'
import Table from '../components/ui/Table'
import { useLang } from '../context/LanguageContext'
import { api } from '../lib/api'
import { formatDateTime, formatMoney } from '../lib/format'

const LIMIT = 20
const DELIVERY_LABELS = {
  PENDING: 'Хүлээгдэж буй',
  ASSIGNED: 'Хуваарилагдсан',
  ON_THE_WAY: 'Замд яваа',
  DELIVERED: 'Хүргэгдсэн',
  FAILED: 'Амжилтгүй',
}

const STATUS_TABS = ['', 'NEW', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED']

export default function Orders() {
  const navigate = useNavigate()
  const { t } = useLang()

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [deliveryStatus, setDeliveryStatus] = useState('')
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
    if (deliveryStatus) q.set('deliveryStatus', deliveryStatus)
    api(`/orders?${q}`)
      .then(setData)
      .catch((e) => setError(e))
  }, [search, status, deliveryStatus, page])

  useEffect(() => {
    load()
  }, [load])

  const columns = [
    {
      key: 'orderNo',
      header: t('№'),
      render: (o) => <span className="font-mono">{o.orderNo}</span>,
    },
    { key: 'customerName', header: t('Харилцагч') },
    {
      key: 'phone',
      header: t('Утас'),
      render: (o) => <span className="font-mono tabular-nums">{o.phone}</span>,
    },
    {
      key: 'totalAmount',
      header: t('Дүн'),
      align: 'right',
      render: (o) => (
        <span className="font-mono tabular-nums">
          {formatMoney(o.totalAmount)}
        </span>
      ),
    },
    {
      key: 'orderStatus',
      header: t('Статус'),
      render: (o) => <Badge status={o.orderStatus} />,
    },
    {
      key: 'deliveryStatus',
      header: t('Хүргэлт'),
      render: (o) => <Badge status={o.deliveryStatus} />,
    },
    {
      key: 'assignedDriver',
      header: t('Жолооч'),
      render: (o) => (
        <span className="text-ink-muted text-sm">
          {o.assignedDriver?.fullName ?? '—'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: t('Огноо'),
      render: (o) => (
        <span className="font-mono text-xs text-ink-muted tabular-nums">
          {formatDateTime(o.createdAt)}
        </span>
      ),
    },
    {
      key: 'createdBy',
      header: t('Үүсгэсэн'),
      render: (o) => (
        <span className="text-ink-muted">{o.createdBy?.fullName ?? '—'}</span>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <h1 className="font-serif text-4xl font-medium">{t('Захиалга')}</h1>
        <Button onClick={() => navigate('/orders/new')}>{t('+ Шинэ захиалга')}</Button>
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
            {s ? t(STATUS_LABELS[s]) : t('Бүгд')}
          </button>
        ))}
        <div className="ml-auto flex items-end gap-2">
          <select
            value={deliveryStatus}
            onChange={(e) => {
              setDeliveryStatus(e.target.value)
              setPage(1)
            }}
            className="bg-bg border border-rule rounded px-2 py-2 text-sm focus:outline-none focus:border-ink-muted"
          >
            <option value="">{t('Хүргэлт')}: {t('Бүгд')}</option>
            {['PENDING', 'ASSIGNED', 'ON_THE_WAY', 'DELIVERED', 'FAILED'].map((s2) => (
              <option key={s2} value={s2}>
                {t(DELIVERY_LABELS[s2])}
              </option>
            ))}
          </select>
          <Input
            id="order-search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('№, нэр, утас…')}
            className="w-56"
          />
        </div>
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
            onRowClick={(o) => navigate(`/orders/${o.id}`)}
            empty={t('Захиалга олдсонгүй')}
          />
        )}
      </div>
    </div>
  )
}
