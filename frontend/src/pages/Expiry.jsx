import { useCallback, useEffect, useState } from 'react'
import Button from '../components/ui/Button'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState from '../components/ui/EmptyState'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import { api } from '../lib/api'
import { formatMoneyRound } from '../lib/format'

/**
 * ХУГАЦААНЫ ХЯНАЛТ (V5).
 *
 * Хүнсний нэмэлт бүтээгдэхүүн хугацаатай тул «хэдэн ширхэг байна»
 * гэдэг хангалтгүй — аль нь хэзээ дуусахыг мэдэх ёстой. Энэ хуудас
 * нь няравын өдөр тутмын хэрэгсэл: юу нь эхэлж дуусах вэ, юуг нь
 * устгалд гаргах вэ.
 *
 * Цуврал нь нийлүүлэлт хүлээж авахад автоматаар үүснэ. Хугацаа
 * бүртгэж эхлэхээс өмнөх хуучин үлдэгдэлд «Хугацаа зүүх»-ээр
 * гараар нэмнэ.
 */

/** Төлөв → өнгө ба нэр. Backend-ийн expiryState-тэй ЯГ тохирно. */
const STATES = {
  EXPIRED: {
    label: 'Хугацаа дууссан',
    short: 'Дууссан',
    cls: 'text-alarm border-alarm/40 bg-alarm/12',
    dot: 'bg-alarm',
  },
  CRITICAL: {
    label: 'Яаралтай',
    short: 'Яаралтай',
    cls: 'text-status-cancelled border-status-cancelled/40 bg-status-cancelled/12',
    dot: 'bg-status-cancelled',
  },
  WARNING: {
    label: 'Анхаарах',
    short: 'Анхаарах',
    cls: 'text-status-preparing border-status-preparing/40 bg-status-preparing/12',
    dot: 'bg-status-preparing',
  },
  OK: {
    label: 'Хэвийн',
    short: 'Хэвийн',
    cls: 'text-safe border-safe/40 bg-safe/12',
    dot: 'bg-safe',
  },
}

/** «-5 хоног» биш «5 хоногийн өмнө дууссан» гэж уншигдахаар */
function daysText(d, t) {
  if (d < 0) return `${Math.abs(d)} ${t('хоногийн өмнө дууссан')}`
  if (d === 0) return t('Өнөөдөр дуусна')
  return `${d} ${t('хоног үлдсэн')}`
}

function fmtDate(iso) {
  return iso.slice(0, 10).replace(/-/g, '.')
}

export default function Expiry() {
  const { t } = useLang()
  const { hasPerm } = useAuth()
  const toast = useToast()
  const canEdit = hasPerm('inventory.adjustment')

  const [summary, setSummary] = useState(null)
  const [rows, setRows] = useState(null)
  const [state, setState] = useState('ALL')
  const [error, setError] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [writeOff, setWriteOff] = useState(null)

  const load = useCallback(() => {
    setError(null)
    Promise.all([
      api('/batches/summary'),
      api(`/batches${state === 'ALL' ? '' : `?state=${state}`}`),
    ])
      .then(([s, r]) => {
        setSummary(s)
        setRows(r)
      })
      .catch(setError)
  }, [state])

  useEffect(() => {
    load()
  }, [load])

  const doWriteOff = async () => {
    try {
      await api(`/batches/${writeOff.id}/write-off`, { method: 'POST', body: {} })
      toast.show(t('Устгалд гаргалаа'))
      setWriteOff(null)
      load()
    } catch (e) {
      toast.show(e.message, { type: 'error' })
    }
  }

  if (error) {
    return (
      <div>
        <h1 className="font-serif text-4xl font-medium">{t('Хугацаа')}</h1>
        <p className="mt-8 text-sm text-alarm border border-alarm rounded px-3 py-2">
          {error.message}
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-4xl font-medium">{t('Хугацаа')}</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {summary
              ? `${t('Дуусахаас')} ${summary.warnDays} ${t('хоногийн өмнө анхааруулна')}`
              : t('Барааны цуврал ба дуусах хугацаа')}
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setAddOpen(true)}>{t('+ Хугацаа зүүх')}</Button>
        )}
      </div>

      {/* Хураангуй — дарвал тухайн бүлгээр шүүнэ */}
      {summary && (
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(STATES).map(([key, s]) => {
            const b = summary[key]
            const active = state === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setState(active ? 'ALL' : key)}
                className={`text-left border rounded-lg px-4 py-3 transition-colors ${
                  active ? 'border-ink bg-surface' : 'border-rule hover:border-ink-muted'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                  <span className="text-sm text-ink-muted">{t(s.label)}</span>
                </span>
                <p className="mt-2 font-mono text-2xl tabular-nums">{b.qty}</p>
                <p className="text-xs text-ink-muted font-mono tabular-nums">
                  {b.batches} {t('цуврал')} · {formatMoneyRound(b.value)}
                </p>
              </button>
            )
          })}
        </div>
      )}

      {state !== 'ALL' && (
        <p className="mt-4 text-sm text-ink-muted">
          {t('Шүүлт')}: {t(STATES[state].label)}
          <button
            type="button"
            onClick={() => setState('ALL')}
            className="ml-2 underline hover:text-ink"
          >
            {t('цуцлах')}
          </button>
        </p>
      )}

      {rows === null ? (
        <div className="mt-16 flex justify-center">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={t('Цуврал алга')}
            note={t(
              'Нийлүүлэлт хүлээж авахад хугацаа оруулбал энд бүртгэгдэнэ',
            )}
          />
        </div>
      ) : (
        <ul className="mt-6 border border-rule rounded-lg divide-y divide-rule">
          {rows.map((b) => {
            const s = STATES[b.state]
            return (
              <li key={b.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{b.product.name}</span>
                      <span
                        className={`inline-flex font-mono text-[11px] uppercase tracking-wide border rounded px-1.5 py-0.5 ${s.cls}`}
                      >
                        {t(s.short)}
                      </span>
                      {b.batchNo && (
                        <span className="font-mono text-xs text-ink-muted">
                          {b.batchNo}
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-sm">
                      <span className="font-mono tabular-nums">
                        {fmtDate(b.expiryDate)}
                      </span>
                      <span className="text-ink-muted">
                        {' · '}
                        {daysText(b.daysLeft, t)}
                      </span>
                    </p>
                    <p className="text-xs text-ink-muted font-mono">
                      {b.supply
                        ? `${b.supply.number}`
                        : t('гараар бүртгэсэн')}
                      {' · '}
                      {b.createdBy.fullName}
                      {b.note ? ` · ✎ ${b.note}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono tabular-nums text-lg">
                      {b.remaining}
                      <span className="text-ink-muted text-sm">
                        /{b.qty} {b.product.unit}
                      </span>
                    </p>
                    {canEdit && (b.state === 'EXPIRED' || b.state === 'CRITICAL') && (
                      <Button
                        variant="ghost"
                        className="mt-2"
                        onClick={() => setWriteOff(b)}
                      >
                        {t('Устгалд гаргах')}
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {addOpen && (
        <AddBatchModal
          t={t}
          toast={toast}
          onClose={() => setAddOpen(false)}
          onDone={() => {
            setAddOpen(false)
            load()
          }}
        />
      )}

      {writeOff && (
        <ConfirmDialog
          open
          title={t('Устгалд гаргах уу?')}
          message={`${writeOff.product.name} — ${writeOff.remaining} ${writeOff.product.unit}. ${t(
            'Үлдэгдлээс хасагдаж, агуулахын хөдөлгөөнд бүртгэгдэнэ. Буцаах боломжгүй.',
          )}`}
          danger
          confirmLabel={t('Устгалд гаргах')}
          onConfirm={doWriteOff}
          onCancel={() => setWriteOff(null)}
        />
      )}
    </div>
  )
}

/**
 * Хуучин үлдэгдэлд хугацаа зүүх.
 *
 * Үлдэгдлийг НЭМЭХГҮЙ — зөвхөн «одоо байгаа барааны хэд нь хэзээ
 * дуусах вэ» гэдгийг тэмдэглэнэ. Тиймээс backend нь хугацаа
 * зүүгээгүй үлдэгдлээс хэтрүүлэхийг хориглодог.
 */
function AddBatchModal({ t, toast, onClose, onDone }) {
  const [products, setProducts] = useState([])
  const [productId, setProductId] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [qty, setQty] = useState('')
  const [batchNo, setBatchNo] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api('/products?limit=200')
      .then((d) => setProducts(d.items ?? d))
      .catch(() => setProducts([]))
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api('/batches', {
        method: 'POST',
        body: {
          productId,
          expiryDate,
          qty: Number(qty),
          ...(batchNo.trim() ? { batchNo: batchNo.trim() } : {}),
        },
      })
      toast.show(t('Хугацаа бүртгэлээ'))
      onDone()
    } catch (err) {
      toast.show(err.message, { type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const picked = products.find((p) => p.id === productId)

  return (
    <Modal open onClose={onClose} title={t('Хугацаа зүүх')}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-ink-muted">
          {t(
            'Агуулахад аль хэдийн байгаа барааны хэд нь хэзээ дуусахыг тэмдэглэнэ. Үлдэгдэл нэмэгдэхгүй.',
          )}
        </p>

        <Select
          id="bt-product"
          label={t('Бараа')}
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          required
        >
          <option value="">{t('— сонгох —')}</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.stockQty} {p.unit})
            </option>
          ))}
        </Select>

        <Input
          id="bt-expiry"
          label={t('Дуусах хугацаа')}
          type="date"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          required
        />

        <Input
          id="bt-qty"
          label={`${t('Тоо ширхэг')}${picked ? ` (${t('үлдэгдэл')} ${picked.stockQty})` : ''}`}
          type="number"
          min="1"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          required
        />

        <Input
          id="bt-no"
          label={`${t('Цувралын дугаар')} — ${t('заавал биш')}`}
          value={batchNo}
          onChange={(e) => setBatchNo(e.target.value)}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('Болих')}
          </Button>
          <Button type="submit" disabled={busy || !productId || !expiryDate || !qty}>
            {busy ? t('Хадгалж байна…') : t('Хадгалах')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
