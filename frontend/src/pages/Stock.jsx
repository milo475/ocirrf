import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import Table from '../components/ui/Table'
import { api } from '../lib/api'
import { formatDateTime } from '../lib/format'

const LIMIT = 20

/** reason кодыг монгол badge болгоно */
const REASONS = {
  ORDER: { label: 'Захиалга', cls: 'text-status-new border-status-new/40 bg-status-new/12' },
  ORDER_CANCEL: { label: 'Цуцлалт', cls: 'text-status-cancelled border-status-cancelled/40 bg-status-cancelled/12' },
  INITIAL: { label: 'Эхний орлого', cls: 'text-status-ready border-status-ready/40 bg-status-ready/12' },
  MANUAL: { label: 'Гар тохируулга', cls: 'text-ink-muted border-rule bg-surface' },
}

function ReasonBadge({ reason }) {
  const r = REASONS[reason] ?? {
    label: reason, // хэрэглэгчийн бичсэн чөлөөт шалтгаан
    cls: 'text-ink-muted border-rule bg-surface',
  }
  return (
    <span
      className={`inline-flex font-mono text-[11px] uppercase tracking-wide border rounded px-1.5 py-0.5 ${r.cls}`}
    >
      {r.label}
    </span>
  )
}

export default function Stock() {
  const [productId, setProductId] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [products, setProducts] = useState([])

  const load = useCallback(() => {
    setError(null)
    const q = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
    if (productId) q.set('productId', productId)
    api(`/stock/movements?${q}`)
      .then(setData)
      .catch((e) => setError(e))
  }, [productId, page])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    api('/products?limit=100')
      .then((d) => setProducts(d.items))
      .catch(() => {})
  }, [])

  const columns = [
    {
      key: 'createdAt',
      header: 'Огноо',
      render: (m) => (
        <span className="font-mono text-xs text-ink-muted tabular-nums">
          {formatDateTime(m.createdAt)}
        </span>
      ),
    },
    {
      key: 'product',
      header: 'Бараа',
      render: (m) => (
        <span>
          {m.product.name}
          <span className="font-mono text-xs text-ink-muted ml-2">
            {m.product.sku}
          </span>
        </span>
      ),
    },
    {
      key: 'qtyChange',
      header: 'Өөрчлөлт',
      align: 'right',
      render: (m) => (
        <span
          className={`font-mono tabular-nums ${
            m.qtyChange > 0 ? 'text-safe' : 'text-alarm'
          }`}
        >
          {m.qtyChange > 0 ? '+' : ''}
          {m.qtyChange}
        </span>
      ),
    },
    {
      key: 'reason',
      header: 'Шалтгаан',
      render: (m) => <ReasonBadge reason={m.reason} />,
    },
    {
      key: 'refId',
      header: 'Холбоос',
      render: (m) =>
        m.refId && (m.reason === 'ORDER' || m.reason === 'ORDER_CANCEL') ? (
          <Link
            to={`/orders/${m.refId}`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm text-ink-muted hover:text-ink underline underline-offset-2"
          >
            Захиалга харах
          </Link>
        ) : (
          <span className="text-ink-muted">—</span>
        ),
    },
    {
      key: 'user',
      header: 'Хэрэглэгч',
      render: (m) => (
        <span className="text-ink-muted text-xs">{m.user?.fullName ?? '—'}</span>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <h1 className="font-serif text-4xl font-medium">Үлдэгдлийн хөдөлгөөн</h1>
        <Select
          id="stock-product"
          value={productId}
          onChange={(e) => {
            setProductId(e.target.value)
            setPage(1)
          }}
          className="w-64"
        >
          <option value="">Бүх бараа</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.sku})
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-8">
        {error ? (
          <EmptyState
            title="Түүх ачаалж чадсангүй"
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
            page={page}
            limit={LIMIT}
            total={data.total}
            onPageChange={setPage}
            empty="Хөдөлгөөн бүртгэгдээгүй"
          />
        )}
      </div>
    </div>
  )
}
