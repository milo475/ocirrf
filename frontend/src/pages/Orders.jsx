import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import PaymentBadge from '../components/orders/PaymentBadge'
import ReturnBadge from '../components/orders/ReturnBadge'
import RegionBadge from '../components/orders/RegionBadge'
import Badge, { STATUS_LABELS } from '../components/ui/Badge'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import Table from '../components/ui/Table'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { useToast } from '../components/ui/Toast'
import { api } from '../lib/api'
import { formatDateTime, formatMoney } from '../lib/format'
import { openPickingSheet } from '../lib/pickingSheet'
import { CHANNELS, channelLabel, channelStyle } from '../lib/channels'
import { DISTRICTS } from '../data/aimags'

const LIMIT = 20
const DELIVERY_LABELS = {
  PENDING: 'Хүлээгдэж буй',
  ASSIGNED: 'Хуваарилагдсан',
  ON_THE_WAY: 'Замд яваа',
  DELIVERED: 'Хүргэгдсэн',
  FAILED: 'Амжилтгүй',
}

const STATUS_TABS = ['', 'NEW', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED']

/** Бэлтгэх хуудсанд сонгож болох статусууд (V4-11) */
const PICKABLE = ['CONFIRMED', 'PREPARING']
/** Жолооч хуваарилж болох статусууд (V5 — олноор хуваарилахад) */
const ASSIGNABLE = ['CONFIRMED', 'PREPARING', 'READY']

export default function Orders() {
  const navigate = useNavigate()
  const { t } = useLang()
  const { hasPerm } = useAuth()
  const toast = useToast()

  // /customers-аас ?search=утас-аар шүүгдэж ирж болно
  const [params] = useSearchParams()
  const [searchInput, setSearchInput] = useState(params.get('search') ?? '')
  const [search, setSearch] = useState(params.get('search') ?? '')
  const [status, setStatus] = useState('')
  const [deliveryStatus, setDeliveryStatus] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [channel, setChannel] = useState('')
  const [district, setDistrict] = useState('')
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
    if (paymentStatus) q.set('paymentStatus', paymentStatus)
    if (channel) q.set('channel', channel)
    if (district) q.set('district', district)
    api(`/orders?${q}`)
      .then(setData)
      .catch((e) => setError(e))
  }, [search, status, deliveryStatus, paymentStatus, channel, district, page])

  useEffect(() => {
    load()
  }, [load])

  // ── Бэлтгэх хуудас (V4-11) ──
  const [selected, setSelected] = useState(() => new Set())
  const [sheetBusy, setSheetBusy] = useState(false)
  const [prepareAsk, setPrepareAsk] = useState(null) // [{id, orderNo, orderStatus}]
  const [preparing, setPreparing] = useState(false)

  function toggleSelect(o) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(o.id)) next.delete(o.id)
      else next.add(o.id)
      return next
    })
  }

  async function openSheet(ids) {
    setSheetBusy(true)
    try {
      const details = await Promise.all(ids.map((id) => api(`/orders/${id}`)))
      // SKU best effort — inventory.view эрхтэй бол бараануудаас татна
      const skuById = {}
      if (hasPerm('inventory.view')) {
        const pids = [...new Set(details.flatMap((o) => o.items.map((i) => i.productId)))]
        await Promise.all(
          pids.slice(0, 30).map((pid) =>
            api(`/products/${pid}`)
              .then((p) => {
                skuById[pid] = p.sku
              })
              .catch(() => {}),
          ),
        )
      }
      if (!openPickingSheet(details, t, skuById)) {
        toast.show(t('Popup хориглогдсон — зөвшөөрнө үү'), { type: 'error' })
        return
      }
      // Хэвлэсний дараа PREPARING руу шилжүүлэх санал (CONFIRMED-уудад)
      const confirmed = details.filter((o) => o.orderStatus === 'CONFIRMED')
      if (confirmed.length > 0 && hasPerm('orders.change_status')) {
        setPrepareAsk(confirmed)
      }
    } catch (e) {
      toast.show(e.message, { type: 'error' })
    } finally {
      setSheetBusy(false)
    }
  }

  // ── Олноор жолооч хуваарилах (V5) ──
  const [bulkOpen, setBulkOpen] = useState(false)

  async function bulkAssign(driverId) {
    const res = await api('/orders/assign-driver/bulk', {
      method: 'PATCH',
      body: { driverId, orderIds: [...selected] },
    })
    setBulkOpen(false)
    setSelected(new Set())
    if (res.assigned > 0) {
      toast.show(t('{n} захиалга хуваарилагдлаа', { n: res.assigned }))
    }
    if (res.failed.length > 0) {
      toast.show(
        t('Хуваарилж чадсангүй: {list}', {
          list: res.failed.map((f) => f.orderNo).join(', '),
        }),
        { type: 'error' },
      )
    }
    load()
  }

  async function markPreparing() {
    setPreparing(true)
    let ok = 0
    const failed = []
    for (const o of prepareAsk) {
      try {
        await api(`/orders/${o.id}/status`, {
          method: 'PATCH',
          body: { status: 'PREPARING' },
        })
        ok++
      } catch {
        failed.push(o.orderNo)
      }
    }
    setPreparing(false)
    setPrepareAsk(null)
    setSelected(new Set())
    if (ok > 0) toast.show(t('{n} захиалга Бэлтгэж буй боллоо', { n: ok }))
    if (failed.length > 0) {
      toast.show(
        t('Шилжүүлж чадсангүй: {list}', { list: failed.join(', ') }),
        { type: 'error' },
      )
    }
    load()
  }

  const columns = [
    {
      key: '_pick',
      header: '',
      render: (o) =>
        [...PICKABLE, ...ASSIGNABLE].includes(o.orderStatus) ? (
          <input
            type="checkbox"
            checked={selected.has(o.id)}
            onChange={() => toggleSelect(o)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`${o.orderNo} ${t('сонгох')}`}
            className="accent-accent w-4 h-4 align-middle"
          />
        ) : null,
    },
    {
      key: 'orderNo',
      header: t('№'),
      render: (o) => <span className="font-mono">{o.orderNo}</span>,
    },
    { key: 'customerName', header: t('Хүлээн авагч') },
    {
      key: 'channel',
      header: t('Суваг'),
      render: (o) => (
        <span
          className={`inline-flex font-mono text-[10px] uppercase tracking-wide border rounded px-1 py-0.5 ${channelStyle(o.channel)}`}
        >
          {t(channelLabel(o.channel))}
        </span>
      ),
    },
    {
      key: 'phone',
      header: t('Утас'),
      render: (o) => <span className="font-mono tabular-nums">{o.phone}</span>,
    },
    {
      key: 'shortAddress',
      header: t('Хаяг'),
      render: (o) => (
        <span className="flex items-center gap-2">
          <RegionBadge region={o.region} />
          <span className="text-sm">{o.shortAddress || '—'}</span>
        </span>
      ),
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
      key: 'paymentStatus',
      header: t('Төлбөр'),
      render: (o) => (
        <span className="inline-flex items-center gap-1">
          <PaymentBadge status={o.paymentStatus} />
          <ReturnBadge state={o.returnState} />
        </span>
      ),
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
        <span className="flex items-center gap-2">
          {selected.size > 0 && hasPerm('orders.assign_driver') && (
            <Button variant="ghost" onClick={() => setBulkOpen(true)}>
              🚚 {t('Жолооч хуваарилах')} ({selected.size})
            </Button>
          )}
          {selected.size > 0 && (
            <Button
              variant="ghost"
              loading={sheetBusy}
              onClick={() => openSheet([...selected])}
            >
              🖨 {t('Бэлтгэх хуудас')} ({selected.size})
            </Button>
          )}
          {hasPerm('orders.create') && (
            <Button onClick={() => navigate('/orders/new')}>
              {t('+ Шинэ захиалга')}
            </Button>
          )}
        </span>
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
            value={district}
            onChange={(e) => {
              setDistrict(e.target.value)
              setPage(1)
            }}
            className="bg-bg border border-rule rounded px-2 py-2 text-sm focus:outline-none focus:border-ink-muted"
          >
            <option value="">{t('Дүүрэг')}: {t('Бүгд')}</option>
            {DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            value={channel}
            onChange={(e) => {
              setChannel(e.target.value)
              setPage(1)
            }}
            className="bg-bg border border-rule rounded px-2 py-2 text-sm focus:outline-none focus:border-ink-muted"
          >
            <option value="">{t('Суваг')}: {t('Бүгд')}</option>
            {CHANNELS.map(([value, label]) => (
              <option key={value} value={value}>
                {t(label)}
              </option>
            ))}
          </select>
          <select
            value={paymentStatus}
            onChange={(e) => {
              setPaymentStatus(e.target.value)
              setPage(1)
            }}
            className="bg-bg border border-rule rounded px-2 py-2 text-sm focus:outline-none focus:border-ink-muted"
          >
            <option value="">{t('Төлбөр')}: {t('Бүгд')}</option>
            <option value="UNPAID">{t('Төлөөгүй')}</option>
            <option value="PARTIAL">{t('Хэсэгчлэн')}</option>
            <option value="PAID">{t('Төлсөн')}</option>
          </select>
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

      {bulkOpen && (
        <BulkAssignModal
          count={selected.size}
          onClose={() => setBulkOpen(false)}
          onAssign={bulkAssign}
          t={t}
        />
      )}

      {/* Хэвлэсний дараах шилжүүлэлт (V4-11) */}
      <ConfirmDialog
        open={!!prepareAsk}
        title={t('Бэлтгэж буй болгох')}
        message={t(
          'Сонгосон {n} захиалгыг «Бэлтгэж буй» болгох уу?',
          { n: prepareAsk?.length ?? 0 },
        )}
        confirmLabel={t('Бэлтгэж буй болгох')}
        loading={preparing}
        onConfirm={markPreparing}
        onCancel={() => setPrepareAsk(null)}
      />
    </div>
  )
}

/** Олноор жолооч хуваарилах цонх (V5) */
function BulkAssignModal({ count, onClose, onAssign, t }) {
  const [drivers, setDrivers] = useState(null)
  const [driverId, setDriverId] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api('/drivers')
      .then((list) => setDrivers(list.filter((d) => d.isActive)))
      .catch(() => setDrivers([]))
  }, [])

  async function submit(e) {
    e.preventDefault()
    if (!driverId) return
    setBusy(true)
    try {
      await onAssign(driverId)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={t('Жолооч хуваарилах')}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-ink-muted">
          {t('Сонгосон {n} захиалгыг нэг жолоочид хуваарилна.', { n: count })}
        </p>
        {drivers === null ? (
          <p className="text-sm text-ink-muted">…</p>
        ) : (
          <Select
            id="bulk-driver"
            label={t('Жолооч')}
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
          >
            <option value="">—</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} · {t('идэвхтэй')} {d.active}
              </option>
            ))}
          </Select>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t('Болих')}
          </Button>
          <Button type="submit" loading={busy} disabled={!driverId}>
            {t('Хуваарилах')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
