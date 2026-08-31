import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'
import { useToast } from '../components/ui/Toast'
import { useLang } from '../context/LanguageContext'
import { api } from '../lib/api'
import { formatMoneyRound } from '../lib/format'

/**
 * ДАВТАН ЗАХИАЛГЫН ДАРААЛАЛ (V5).
 *
 * Нэмэлт бүтээгдэхүүнийг хүн тодорхой хоногт дуусгадаг. Систем нь
 * хэн юуг хэзээ авснаа мэддэг тул «хэзээ дуусах» нь тооцоологдоно.
 * Өмнө нь борлуулагч үүнийг толгойдоо санаж, гараар мессеж бичдэг
 * байв.
 *
 * Жагсаалт хоосон байх нь ХЭВИЙН: захиалгын түүх хуримтлагдаж,
 * хүмүүсийн эхний савнууд дуусаж эхлэх үед бөглөрнө.
 */

const STATES = {
  OVERDUE: {
    label: 'Хоцорсон',
    cls: 'text-alarm border-alarm/40 bg-alarm/12',
    dot: 'bg-alarm',
  },
  DUE: {
    label: 'Өнөөдөр',
    cls: 'text-status-cancelled border-status-cancelled/40 bg-status-cancelled/12',
    dot: 'bg-status-cancelled',
  },
  SOON: {
    label: 'Удахгүй',
    cls: 'text-status-preparing border-status-preparing/40 bg-status-preparing/12',
    dot: 'bg-status-preparing',
  },
}

function daysText(d, t) {
  if (d < 0) return `${Math.abs(d)} ${t('хоногийн өмнө дууссан')}`
  if (d === 0) return t('Өнөөдөр дуусна')
  return `${d} ${t('хоногийн дараа дуусна')}`
}

export default function Reorders() {
  const { t } = useLang()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [remind, setRemind] = useState(null)

  const load = useCallback(() => {
    setError(null)
    api('/reorders').then(setData).catch(setError)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (error) {
    return (
      <div>
        <h1 className="font-serif text-4xl font-medium">{t('Дахин захиалга')}</h1>
        <p className="mt-8 text-sm text-alarm border border-alarm rounded px-3 py-2">
          {error.message}
        </p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-serif text-4xl font-medium">{t('Дахин захиалга')}</h1>
      <p className="mt-2 text-sm text-ink-muted">
        {data
          ? `${t('Барааг нь дуусахаас')} ${data.leadDays} ${t('хоногийн өмнөөс сануулна')}`
          : t('Барааг нь дуусах дөхсөн үйлчлүүлэгчид')}
      </p>

      {data && (data.overdue > 0 || data.due > 0) && (
        <div className="mt-8 grid grid-cols-2 gap-3 max-w-md">
          <div className="border border-rule rounded-lg px-4 py-3">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-alarm" />
              <span className="text-sm text-ink-muted">{t('Хоцорсон')}</span>
            </span>
            <p className="mt-2 font-mono text-2xl tabular-nums">{data.overdue}</p>
          </div>
          <div className="border border-rule rounded-lg px-4 py-3">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-status-preparing" />
              <span className="text-sm text-ink-muted">{t('Удахгүй')}</span>
            </span>
            <p className="mt-2 font-mono text-2xl tabular-nums">{data.due}</p>
          </div>
        </div>
      )}

      {data === null ? (
        <div className="mt-16 flex justify-center">
          <Spinner />
        </div>
      ) : data.rows.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title={t('Одоогоор сануулах хүн алга')}
            note={t(
              'Үйлчлүүлэгчийн авсан бараа дуусах дөхөхөд энд гарч ирнэ. Барааны «хэдэн хоног хүрэх» утгыг Бараа хуудсаас тохируулна.',
            )}
          />
        </div>
      ) : (
        <ul className="mt-8 border border-rule rounded-lg divide-y divide-rule">
          {data.rows.map((r) => {
            const s = STATES[r.state]
            return (
              <li key={r.phone} className="px-4 py-3">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">
                        {r.customerName || t('Нэргүй')}
                      </span>
                      <span className="font-mono tabular-nums text-sm text-ink-muted">
                        {r.phone}
                      </span>
                      <span
                        className={`inline-flex font-mono text-[11px] uppercase tracking-wide border rounded px-1.5 py-0.5 ${s.cls}`}
                      >
                        {t(s.label)}
                      </span>
                    </p>
                    <p className="mt-1 text-sm">
                      {r.productName} × {r.qty}
                      <span className="text-ink-muted">
                        {' · '}
                        {daysText(r.daysLeft, t)}
                      </span>
                    </p>
                    <p className="text-xs text-ink-muted font-mono">
                      <Link
                        to={`/orders/${r.lastOrderId}`}
                        className="underline hover:text-ink"
                      >
                        {r.lastOrderNo}
                      </Link>
                      {' · '}
                      {r.orderCount} {t('захиалга')}
                      {' · '}
                      {formatMoneyRound(r.totalSpent)}
                    </p>
                  </div>
                  <Button variant="ghost" onClick={() => setRemind(r)}>
                    💬 {t('Сануулга хуулах')}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {remind && (
        <RemindModal row={remind} onClose={() => setRemind(null)} />
      )}
    </div>
  )
}

/**
 * Сануулгын мессеж — DM руу хуулж илгээнэ.
 *
 * DmReplyModal-тай ижил зарчим: илгээхийн өмнө хараад, хэрэгтэй бол
 * засаад хуулна.
 */
function RemindModal({ row, onClose }) {
  const { t } = useLang()
  const toast = useToast()
  const [settings, setSettings] = useState(null)
  const [edited, setEdited] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    api('/settings')
      .then(setSettings)
      .catch(() => setSettings({}))
  }, [])

  const built = settings
    ? (settings.reorderTemplate || '')
        .split('{нэр}')
        .join(row.customerName || t('Сайн байна уу'))
        .split('{бараа}')
        .join(row.productName)
        .split('{хоног}')
        .join(String(Math.abs(row.daysLeft)))
        .split('{утас}')
        .join(settings.companyPhone || '')
        .split('{компани}')
        .join(settings.companyName || '')
        // Утас тохируулаагүй бол товьёг болж хоцорсон мөрийг хаяна
        .split('\n')
        .filter((l) => !/:\s*$/.test(l))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    : ''

  const text = edited ?? built

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.show(t('Хуулагдлаа — DM руу буулгана уу'))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.show(t('Гараар хуулна уу (Ctrl+C)'), { type: 'error' })
    }
  }

  return (
    <Modal open onClose={onClose} title={t('Сануулгын мессеж')}>
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">
          {row.customerName || t('Нэргүй')} ·{' '}
          <span className="font-mono">{row.phone}</span>
        </p>
        {settings === null ? (
          <p className="text-sm text-ink-muted">{t('Ачааллаж байна…')}</p>
        ) : (
          <>
            <textarea
              aria-label={t('Илгээх мессеж')}
              value={text}
              onChange={(e) => setEdited(e.target.value)}
              rows={10}
              className="w-full bg-bg border border-rule rounded px-3 py-2 text-sm leading-relaxed resize-y focus:outline-none focus:border-ink-muted"
            />
            <p className="text-xs text-ink-muted">
              {t('Загварыг Тохиргоо хуудсаас өөрчилнө')}
            </p>
          </>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            {t('Хаах')}
          </Button>
          <Button onClick={copy} disabled={!text}>
            {copied ? `✓ ${t('Хуулсан')}` : t('Хуулах')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
