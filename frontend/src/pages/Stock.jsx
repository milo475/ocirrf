import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import Table from '../components/ui/Table'
import { useLang } from '../context/LanguageContext'
import { api } from '../lib/api'
import { formatDateTime } from '../lib/format'

const LIMIT = 20

/** reason кодыг монгол badge болгоно */
const REASONS = {
  ORDER: { label: 'reason.order', cls: 'text-status-new border-status-new/40 bg-status-new/12' },
  ORDER_CANCEL: { label: 'Цуцлалт', cls: 'text-status-cancelled border-status-cancelled/40 bg-status-cancelled/12' },
  SUPPLY: { label: 'Нийлүүлэлт', cls: 'text-safe border-safe/40 bg-safe/12' },
  ORDER_EDIT: { label: 'Захиалга засвар', cls: 'text-status-preparing border-status-preparing/40 bg-status-preparing/12' },
  PURCHASE_IN: { label: 'Орлого', cls: 'text-status-ready border-status-ready/40 bg-status-ready/12' },
  MANUAL_OUT: { label: 'Зарлага', cls: 'text-status-preparing border-status-preparing/40 bg-status-preparing/12' },
  CORRECTION: { label: 'Залруулга', cls: 'text-status-confirmed border-status-confirmed/40 bg-status-confirmed/12' },
  INITIAL: { label: 'Эхний орлого', cls: 'text-status-ready border-status-ready/40 bg-status-ready/12' },
  MANUAL: { label: 'Гар тохируулга', cls: 'text-ink-muted border-rule bg-surface' },
}

function ReasonBadge({ reason, t }) {
  const known = REASONS[reason]
  const r = known
    ? { ...known, label: t(known.label) }
    : { label: reason, cls: 'text-ink-muted border-rule bg-surface' } // чөлөөт шалтгаан
  return (
    <span
      className={`inline-flex font-mono text-[11px] uppercase tracking-wide border rounded px-1.5 py-0.5 ${r.cls}`}
    >
      {r.label}
    </span>
  )
}

export default function Stock() {
  const { t } = useLang()
  const [productId, setProductId] = useState('')
  const [reason, setReason] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [products, setProducts] = useState([])

  const load = useCallback(() => {
    setError(null)
    const q = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
    if (productId) q.set('productId', productId)
    if (reason) q.set('reason', reason)
    api(`/stock/movements?${q}`)
      .then(setData)
      .catch((e) => setError(e))
  }, [productId, reason, page])

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
      header: t('Огноо'),
      render: (m) => (
        <span className="font-mono text-xs text-ink-muted tabular-nums">
          {formatDateTime(m.createdAt)}
        </span>
      ),
    },
    {
      key: 'product',
      header: t('Бараа'),
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
      header: t('Өөрчлөлт'),
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
      header: t('Шалтгаан'),
      render: (m) => (
        <span>
          <ReasonBadge reason={m.reason} t={t} />
          {m.note && (
            <span className="block text-xs text-ink-muted mt-0.5 max-w-44 truncate" title={m.note}>
              {m.note}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'refId',
      header: t('Холбоос'),
      render: (m) =>
        m.refId && (m.reason === 'ORDER' || m.reason === 'ORDER_CANCEL') ? (
          <Link
            to={`/orders/${m.refId}`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm text-ink-muted hover:text-ink underline underline-offset-2"
          >
            {t('Захиалга харах')}
          </Link>
        ) : (
          <span className="text-ink-muted">—</span>
        ),
    },
    {
      key: 'user',
      header: t('Хэрэглэгч'),
      render: (m) => (
        <span className="text-ink-muted text-xs">{m.user?.fullName ?? '—'}</span>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <h1 className="font-serif text-4xl font-medium">{t('Үлдэгдлийн хөдөлгөөн')}</h1>
        <Select
          id="stock-reason"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value)
            setPage(1)
          }}
          className="w-44"
        >
          <option value="">{t('Шалтгаан')}: {t('Бүгд')}</option>
          {Object.entries(REASONS)
            .filter(([k]) => k !== 'MANUAL')
            .map(([k, v]) => (
              <option key={k} value={k}>
                {t(v.label)}
              </option>
            ))}
        </Select>
        <Select
          id="stock-product"
          value={productId}
          onChange={(e) => {
            setProductId(e.target.value)
            setPage(1)
          }}
          className="w-64"
        >
          <option value="">{t('Бүх бараа')}</option>
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
            title={t('Түүх ачаалж чадсангүй')}
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
            page={page}
            limit={LIMIT}
            total={data.total}
            onPageChange={setPage}
            empty={t('Хөдөлгөөн бүртгэгдээгүй')}
          />
        )}
      </div>
    </div>
  )
}
