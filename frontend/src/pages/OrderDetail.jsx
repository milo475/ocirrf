import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'
import { useToast } from '../components/ui/Toast'
import { api } from '../lib/api'
import { formatDateTime, formatMoney } from '../lib/format'
import { TRANSITIONS, TRANSITION_LABELS } from '../lib/orderStatus'

function InfoItem({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1">{value}</p>
    </div>
  )
}

export default function OrderDetail() {
  const { id } = useParams()
  const toast = useToast()

  const [order, setOrder] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  const load = useCallback(() => {
    setError(null)
    api(`/orders/${id}`)
      .then(setOrder)
      .catch((e) => setError(e))
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function transition(status) {
    setBusy(true)
    try {
      await api(`/orders/${id}/status`, { method: 'PATCH', body: { status } })
      toast.show(
        status === 'CANCELLED'
          ? 'Захиалга цуцлагдаж, үлдэгдэл буцаан нэмэгдлээ'
          : 'Статус шинэчлэгдлээ',
      )
      setCancelOpen(false)
      load()
    } catch (e) {
      toast.show(e.message, { type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  if (error) {
    return (
      <EmptyState
        title="Захиалга ачаалж чадсангүй"
        note={error.message}
        action={<Button onClick={load}>Дахин оролдох</Button>}
      />
    )
  }

  if (!order) {
    return (
      <div className="py-16 text-center">
        <Spinner size={22} />
      </div>
    )
  }

  // Frontend талд зөвхөн харагдах товчнууд — жинхэнэ шалгалт backend-д
  const nextStatuses = TRANSITIONS[order.orderStatus] ?? []
  const forward = nextStatuses.filter((s) => s !== 'CANCELLED')
  const canCancel = nextStatuses.includes('CANCELLED')

  return (
    <div className="max-w-3xl">
      <Link to="/orders" className="text-sm text-ink-muted hover:text-ink">
        ← Захиалгын жагсаалт
      </Link>

      <div className="mt-4 flex items-center justify-between gap-4 flex-wrap">
        <h1 className="font-mono text-3xl tabular-nums">{order.orderNo}</h1>
        <Badge status={order.orderStatus} />
      </div>

      {/* Толгой мэдээлэл */}
      <section className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-5">
        <InfoItem label="Харилцагч" value={order.customerName} />
        <InfoItem
          label="Утас"
          value={<span className="font-mono tabular-nums">{order.phone}</span>}
        />
        <InfoItem
          label="Огноо"
          value={
            <span className="font-mono text-sm tabular-nums">
              {formatDateTime(order.createdAt)}
            </span>
          }
        />
        <InfoItem
          label="Үүсгэсэн"
          value={order.createdBy?.fullName ?? '—'}
        />
        {order.address && <InfoItem label="Хаяг" value={order.address} />}
        {order.note && <InfoItem label="Тэмдэглэл" value={order.note} />}
      </section>

      {/* Item-ууд — захиалга үүсэх үеийн snapshot утгууд */}
      <section className="mt-10 border-t border-rule pt-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-ink-muted border-b border-rule">
              <th className="text-left font-normal py-2">Бараа</th>
              <th className="text-right font-normal py-2 px-3">Нэгж үнэ</th>
              <th className="text-right font-normal py-2 px-3">Тоо</th>
              <th className="text-right font-normal py-2">Дүн</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-rule">
                <td className="py-2.5 font-sans">{item.productName}</td>
                <td className="text-right px-3">
                  {formatMoney(item.priceAtOrder)}
                </td>
                <td className="text-right px-3">{item.qty}</td>
                <td className="text-right">{formatMoney(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex justify-end items-baseline gap-3">
          <span className="text-sm text-ink-muted">Нийт</span>
          <span className="font-mono text-2xl tabular-nums">
            {formatMoney(order.totalAmount)}
          </span>
        </div>
      </section>

      {/* Статусын шилжилтийн товчнууд */}
      {(forward.length > 0 || canCancel) && (
        <section className="mt-10 border-t border-rule pt-6 flex items-center gap-3">
          {forward.map((s) => (
            <Button key={s} loading={busy} onClick={() => transition(s)}>
              {TRANSITION_LABELS[s]}
            </Button>
          ))}
          {canCancel && (
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => setCancelOpen(true)}
              className="ml-auto"
            >
              Цуцлах
            </Button>
          )}
        </section>
      )}

      <ConfirmDialog
        open={cancelOpen}
        title="Захиалга цуцлах"
        message="Үлдэгдэл буцаан нэмэгдэнэ. Цуцлах уу?"
        confirmLabel="Цуцлах"
        danger
        loading={busy}
        onConfirm={() => transition('CANCELLED')}
        onCancel={() => setCancelOpen(false)}
      />
    </div>
  )
}
