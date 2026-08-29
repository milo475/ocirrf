import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import CustomerHistoryModal from '../components/customers/CustomerHistoryModal'
import Button from '../components/ui/Button'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import { channelLabel, channelStyle } from '../lib/channels'
import { api } from '../lib/api'
import { formatDateTime, formatMoney } from '../lib/format'

/**
 * Нийтийн линкээр ирсэн захиалгын хүсэлтүүд (V5).
 * Ажилтан мөнгө орсон эсэх, хаяг зөв эсэхийг шалгаад [Захиалга болгох]
 * дарна — ЭНД л жинхэнэ захиалга үүсч үлдэгдэл хасагдана.
 */
export default function OrderRequests() {
  const { t } = useLang()
  const { hasPerm } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [status, setStatus] = useState('NEW')
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const [proof, setProof] = useState(null)
  const [link, setLink] = useState(null)
  const [history, setHistory] = useState(null)

  const load = useCallback(() => {
    setError(null)
    setRows(null)
    api(`/order-requests?status=${status}`)
      .then(setRows)
      .catch((e) => setError(e))
  }, [status])

  useEffect(() => {
    load()
    // Шинэ хүсэлт ирэхэд хонхтой хамт жагсаалт шинэчлэгдэнэ (SSE)
    window.addEventListener('notif:push', load)
    return () => window.removeEventListener('notif:push', load)
  }, [load])

  useEffect(() => {
    api('/order-requests/link')
      .then((d) => setLink(`${window.location.origin}/z/${d.token}`))
      .catch(() => {})
  }, [])

  async function convert(r) {
    setBusyId(r.id)
    try {
      const order = await api(`/order-requests/${r.id}/convert`, { method: 'POST' })
      toast.show(t('Захиалга {no} үүслээ', { no: order.orderNo }))
      navigate(`/orders/${order.id}`)
    } catch (e) {
      toast.show(e.message, { type: 'error' })
      setBusyId(null)
    }
  }

  async function reject() {
    setBusyId(rejecting.id)
    try {
      await api(`/order-requests/${rejecting.id}/reject`, { method: 'POST' })
      toast.show(t('Хүсэлт хаагдлаа'))
      setRejecting(null)
      load()
    } catch (e) {
      toast.show(e.message, { type: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  const address = (r) =>
    r.region === 'ULAANBAATAR'
      ? [r.district, r.khoroo && `${r.khoroo}-р хороо`, r.building, r.entrance && `${r.entrance}-р орц`, r.floor && `${r.floor} давхар`, r.door && `${r.door} тоот`]
          .filter(Boolean)
          .join(', ')
      : [r.province, r.soum, r.transport && `Тээвэр: ${r.transport}`, r.addressDetail]
          .filter(Boolean)
          .join(', ')

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <h1 className="font-serif text-4xl font-medium">{t('Хүсэлтүүд')}</h1>
        {link && (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard
                .writeText(link)
                .then(() => toast.show(t('Линк хуулагдлаа')))
                .catch(() => toast.show(link))
            }}
            className="text-sm text-accent underline underline-offset-2"
            title={link}
          >
            🔗 {t('Захиалгын линк хуулах')}
          </button>
        )}
      </div>

      <div className="mt-8 flex gap-1 border-b border-rule pb-3">
        {[
          ['NEW', 'Шинэ'],
          ['CONVERTED', 'Захиалга болсон'],
          ['REJECTED', 'Хаасан'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatus(key)}
            className={`px-3 py-1.5 rounded text-sm transition-colors ${
              status === key ? 'bg-surface text-ink' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {t(label)}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {error ? (
          <EmptyState
            title={t('Жагсаалт ачаалж чадсангүй')}
            note={error.message}
            action={<Button onClick={load}>{t('Дахин оролдох')}</Button>}
          />
        ) : !rows ? (
          <div className="py-16 text-center">
            <Spinner size={22} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title={t('Хүсэлт алга')} />
        ) : (
          <ul className="space-y-4">
            {rows.map((r) => (
              <li key={r.id} className="border border-rule rounded-lg p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{r.customerName}</span>
                      {hasPerm('customers.view') ? (
                        <button
                          type="button"
                          onClick={() =>
                            setHistory({ phone: r.phone, name: r.customerName })
                          }
                          title={t('Худалдан авалтын түүх')}
                          className="font-mono tabular-nums text-accent underline underline-offset-2"
                        >
                          {r.phone}
                        </button>
                      ) : (
                        <span className="font-mono tabular-nums">{r.phone}</span>
                      )}
                      {r.socialName && (
                        <span className="text-sm text-accent">{r.socialName}</span>
                      )}
                      <span
                        className={`inline-flex font-mono text-[10px] uppercase border rounded px-1 py-0.5 ${channelStyle(r.channel)}`}
                      >
                        {t(channelLabel(r.channel))}
                      </span>
                      <span
                        className={`inline-flex font-mono text-[10px] uppercase border rounded px-1 py-0.5 ${
                          r.paid
                            ? 'text-safe border-safe/40 bg-safe/12'
                            : 'text-alarm border-alarm/40 bg-alarm/10'
                        }`}
                      >
                        {t(r.paid ? 'Төлсөн гэсэн' : 'Төлөөгүй')}
                      </span>
                    </p>
                    <p className="mt-1 text-sm">{address(r)}</p>
                    {r.note && (
                      <p className="mt-1 text-sm text-ink-muted">✎ {r.note}</p>
                    )}
                  </div>
                  <span className="font-mono text-xs text-ink-muted tabular-nums">
                    {formatDateTime(r.createdAt)}
                  </span>
                </div>

                <ul className="mt-3 border-y border-rule divide-y divide-rule">
                  {r.items.map((i) => (
                    <li
                      key={i.productId}
                      className="py-1.5 flex items-center gap-3 text-sm"
                    >
                      <span className="flex-1 truncate">{i.name}</span>
                      <span className="font-mono tabular-nums">×{i.qty}</span>
                      <span className="font-mono tabular-nums w-28 text-right">
                        {formatMoney(Number(i.price) * i.qty)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-right">
                  {t('Нийт')}{' '}
                  <span className="font-mono text-lg tabular-nums ml-2">
                    {formatMoney(r.total)}
                  </span>
                </p>

                {status === 'NEW' && (
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    {r.paymentProofUrl && (
                      <Button variant="ghost" onClick={() => setProof(r.paymentProofUrl)}>
                        🧾 {t('Гүйлгээний баримт')}
                      </Button>
                    )}
                    {hasPerm('orders.create') && (
                      <>
                        <Button
                          loading={busyId === r.id}
                          onClick={() => convert(r)}
                        >
                          {t('Захиалга болгох')}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setRejecting(r)}
                          className="ml-auto"
                        >
                          {t('Хаах')}
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {history && (
        <CustomerHistoryModal
          phone={history.phone}
          name={history.name}
          onClose={() => setHistory(null)}
        />
      )}

      <Modal
        open={!!proof}
        onClose={() => setProof(null)}
        title={t('Гүйлгээний баримт')}
      >
        {proof && <img src={proof} alt={t('Гүйлгээний баримт')} className="w-full rounded" />}
      </Modal>

      <ConfirmDialog
        open={!!rejecting}
        title={t('Хүсэлт хаах')}
        message={t('Энэ хүсэлтийг хаах уу? Захиалга үүсэхгүй.')}
        confirmLabel={t('Хаах')}
        danger
        loading={busyId === rejecting?.id}
        onConfirm={reject}
        onCancel={() => setRejecting(null)}
      />
    </div>
  )
}
