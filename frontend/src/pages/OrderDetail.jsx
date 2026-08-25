import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import AssignDriverModal from '../components/orders/AssignDriverModal'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'
import Modal from '../components/ui/Modal'
import { useToast } from '../components/ui/Toast'
import { useLang } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
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
  const { user } = useAuth()
  const { t } = useLang()

  const [order, setOrder] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [proofOpen, setProofOpen] = useState(false)

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
          ? t('Захиалга цуцлагдаж, үлдэгдэл буцаан нэмэгдлээ')
          : t('Статус шинэчлэгдлээ'),
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
        title={t('Захиалга ачаалж чадсангүй')}
        note={error.message}
        action={<Button onClick={load}>{t('Дахин оролдох')}</Button>}
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

  // Frontend талд зөвхөн харагдах товчнууд — жинхэнэ шалгалт backend-д.
  // OPERATOR зөвхөн өөрийн шивсэн захиалгыг удирдана.
  const canManage =
    user?.role !== 'OPERATOR' || order.createdBy?.id === user?.id
  const nextStatuses = canManage ? (TRANSITIONS[order.orderStatus] ?? []) : []
  const forward = nextStatuses.filter((s) => s !== 'CANCELLED')
  const canCancel = nextStatuses.includes('CANCELLED')
  const canAssign =
    (user?.role === 'ADMIN' || user?.role === 'MANAGER') &&
    (order.orderStatus === 'CONFIRMED' || order.orderStatus === 'PREPARING')

  return (
    <div className="max-w-3xl">
      <Link to="/orders" className="text-sm text-ink-muted hover:text-ink">
        {t('← Захиалгын жагсаалт')}
      </Link>

      <div className="mt-4 flex items-center justify-between gap-4 flex-wrap">
        <h1 className="font-mono text-3xl tabular-nums">{order.orderNo}</h1>
        <span className="flex items-center gap-2">
          <Badge status={order.orderStatus} />
          <Badge status={order.deliveryStatus} />
        </span>
      </div>

      {/* Толгой мэдээлэл */}
      <section className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-5">
        <InfoItem label={t('Харилцагч')} value={order.customerName} />
        <InfoItem
          label={t('Утас')}
          value={<span className="font-mono tabular-nums">{order.phone}</span>}
        />
        <InfoItem
          label={t('Огноо')}
          value={
            <span className="font-mono text-sm tabular-nums">
              {formatDateTime(order.createdAt)}
            </span>
          }
        />
        <InfoItem
          label={t('Үүсгэсэн')}
          value={order.createdBy?.fullName ?? '—'}
        />
        {order.address && <InfoItem label={t('Хаяг')} value={order.address} />}
        {order.note && <InfoItem label={t('Тэмдэглэл')} value={order.note} />}
      </section>

      {/* Item-ууд — захиалга үүсэх үеийн snapshot утгууд */}
      <section className="mt-10 border-t border-rule pt-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-ink-muted border-b border-rule">
              <th className="text-left font-normal py-2">{t('Бараа')}</th>
              <th className="text-right font-normal py-2 px-3">{t('Нэгж үнэ')}</th>
              <th className="text-right font-normal py-2 px-3">{t('Тоо')}</th>
              <th className="text-right font-normal py-2">{t('Дүн')}</th>
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
          <span className="text-sm text-ink-muted">{t('Нийт')}</span>
          <span className="font-mono text-2xl tabular-nums">
            {formatMoney(order.totalAmount)}
          </span>
        </div>
      </section>

      {/* Хүргэлтийн мэдээлэл */}
      {(order.assignedDriver || order.deliveryProofUrl || order.deliveryNote) && (
        <section className="mt-10 border-t border-rule pt-6">
          <p className="text-xs uppercase tracking-wide text-ink-muted mb-4">
            {t('Хүргэлтийн мэдээлэл')}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-5">
            {order.assignedDriver && (
              <InfoItem label={t('Жолооч')} value={order.assignedDriver.fullName} />
            )}
            {order.assignedAt && (
              <InfoItem
                label={t('Хуваарилсан')}
                value={
                  <span className="font-mono text-sm tabular-nums">
                    {formatDateTime(order.assignedAt)}
                  </span>
                }
              />
            )}
            {order.deliveredAt && (
              <InfoItem
                label={t('Хүргэсэн огноо')}
                value={
                  <span className="font-mono text-sm tabular-nums">
                    {formatDateTime(order.deliveredAt)}
                  </span>
                }
              />
            )}
            {order.deliveryNote && (
              <InfoItem label={t('Тэмдэглэл')} value={order.deliveryNote} />
            )}
          </div>
          {order.deliveryProofUrl && (
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wide text-ink-muted mb-2">
                {t('Баталгаажуулах зураг')}
              </p>
              <button type="button" onClick={() => setProofOpen(true)}>
                <img
                  src={order.deliveryProofUrl}
                  alt={t('Баталгаажуулах зураг')}
                  className="h-24 rounded border border-rule hover:opacity-80 transition-opacity"
                />
              </button>
            </div>
          )}
        </section>
      )}

      {/* Статусын шилжилтийн товчнууд */}
      {(forward.length > 0 || canCancel || canAssign) && (
        <section className="mt-10 border-t border-rule pt-6 flex items-center gap-3">
          {forward.map((s) => (
            <Button key={s} loading={busy} onClick={() => transition(s)}>
              {t(TRANSITION_LABELS[s])}
            </Button>
          ))}
          {canAssign && (
            <Button variant="ghost" onClick={() => setAssignOpen(true)}>
              {t('Жолооч хуваарилах')}
            </Button>
          )}
          {canCancel && (
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => setCancelOpen(true)}
              className="ml-auto"
            >
              {t('Цуцлах')}
            </Button>
          )}
        </section>
      )}

      {assignOpen && (
        <AssignDriverModal
          order={order}
          onClose={() => setAssignOpen(false)}
          onDone={() => {
            setAssignOpen(false)
            load()
          }}
        />
      )}

      <Modal
        open={proofOpen}
        onClose={() => setProofOpen(false)}
        title={t('Баталгаажуулах зураг')}
      >
        {order.deliveryProofUrl && (
          <img
            src={order.deliveryProofUrl}
            alt={t('Баталгаажуулах зураг')}
            className="w-full rounded"
          />
        )}
      </Modal>

      <ConfirmDialog
        open={cancelOpen}
        title={t('Захиалга цуцлах')}
        message={t('Үлдэгдэл буцаан нэмэгдэнэ. Цуцлах уу?')}
        confirmLabel={t('Цуцлах')}
        danger
        loading={busy}
        onConfirm={() => transition('CANCELLED')}
        onCancel={() => setCancelOpen(false)}
      />
    </div>
  )
}
