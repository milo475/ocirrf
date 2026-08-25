import { useCallback, useEffect, useState } from 'react'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'
import { useToast } from '../components/ui/Toast'
import { useLang } from '../context/LanguageContext'
import { api, apiUpload } from '../lib/api'
import { formatMoney } from '../lib/format'

/**
 * Жолоочийн хүргэлтийн хуудас — утсанд зориулагдсан:
 * карт том, утас руу шууд залгана, камер шууд нээгддэг.
 */
export default function MyDeliveries() {
  const { t } = useLang()
  const toast = useToast()

  const [deliveries, setDeliveries] = useState(null)
  const [error, setError] = useState(null)
  const [sheet, setSheet] = useState(null) // баталгаажуулж буй захиалга

  const load = useCallback(() => {
    setError(null)
    api('/deliveries/my')
      .then(setDeliveries)
      .catch((e) => setError(e))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (error) {
    return (
      <EmptyState
        title={t('Өгөгдөл ачаалж чадсангүй')}
        note={error.message}
        action={<Button onClick={load}>{t('Дахин оролдох')}</Button>}
      />
    )
  }

  if (!deliveries) {
    return (
      <div className="py-16 text-center">
        <Spinner size={24} />
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="font-serif text-3xl font-medium">{t('Миний хүргэлт')}</h1>

      {deliveries.length === 0 ? (
        <div className="mt-8">
          <EmptyState title={t('Одоогоор хуваарилагдсан хүргэлт алга')} />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {deliveries.map((d) => (
            <div
              key={d.id}
              className="bg-surface border border-rule rounded-lg p-5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-sm text-ink-muted">
                  {d.orderNo}
                </span>
                <span className="font-mono text-lg tabular-nums">
                  {formatMoney(d.totalAmount)}
                </span>
              </div>

              <p className="mt-3 text-lg font-medium">{d.customerName}</p>
              <a
                href={`tel:${d.phone}`}
                className="mt-1 inline-block font-mono text-xl text-accent underline underline-offset-4"
              >
                📞 {d.phone}
              </a>

              <p className="mt-3 text-lg leading-snug">{d.address}</p>

              <ul className="mt-3 border-t border-rule pt-3 space-y-1">
                {d.items.map((item, i) => (
                  <li key={i} className="flex justify-between gap-3 text-base">
                    <span className="truncate">{item.productName}</span>
                    <span className="font-mono tabular-nums shrink-0">
                      × {item.qty}
                    </span>
                  </li>
                ))}
              </ul>

              {d.note && (
                <p className="mt-3 text-sm text-ink-muted border-l-2 border-accent/50 pl-3">
                  {d.note}
                </p>
              )}

              <Button
                onClick={() => setSheet(d)}
                className="w-full mt-4 py-3.5 text-lg"
              >
                {t('Баталгаажуулах')}
              </Button>
            </div>
          ))}
        </div>
      )}

      {sheet && (
        <CompleteSheet
          delivery={sheet}
          onClose={() => setSheet(null)}
          onDone={() => {
            setSheet(null)
            load()
          }}
          t={t}
          toast={toast}
        />
      )}
    </div>
  )
}

/** Доороос гарах баталгаажуулалтын sheet */
function CompleteSheet({ delivery, onClose, onDone, t, toast }) {
  const [shown, setShown] = useState(false)
  const [success, setSuccess] = useState(true)
  const [photo, setPhoto] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function onPickPhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPhoto(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const canSubmit = success ? !!photo : note.trim().length > 0

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      await apiUpload(`/deliveries/${delivery.id}/complete`, {
        success: String(success),
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(photo ? { photo } : {}),
      })
      toast.show(
        success ? t('Хүргэлт баталгаажлаа') : t('Амжилтгүй гэж тэмдэглэгдлээ'),
      )
      onDone()
    } catch (err) {
      setError(err.message)
      toast.show(err.message, { type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label={t('Хаах')}
        onClick={onClose}
        className={`absolute inset-0 w-full bg-bg transition-opacity duration-300 motion-reduce:transition-none ${
          shown ? 'opacity-60' : 'opacity-0'
        }`}
      />
      <div
        className={`absolute bottom-0 left-0 right-0 bg-surface border-t border-rule rounded-t-2xl p-5 pb-8 max-h-[85vh] overflow-y-auto transition-transform duration-300 motion-reduce:transition-none ${
          shown ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="max-w-md mx-auto space-y-4">
          <p className="font-mono text-sm text-ink-muted">{delivery.orderNo}</p>

          {/* Амжилттай / Амжилтгүй toggle */}
          <div className="grid grid-cols-2 border border-rule rounded overflow-hidden">
            <button
              type="button"
              onClick={() => setSuccess(true)}
              className={`py-3 text-base font-medium transition-colors ${
                success
                  ? 'bg-safe/15 text-safe'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              ✓ {t('Амжилттай')}
            </button>
            <button
              type="button"
              onClick={() => setSuccess(false)}
              className={`py-3 text-base font-medium transition-colors ${
                !success
                  ? 'bg-alarm/15 text-alarm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              ✗ {t('Амжилтгүй')}
            </button>
          </div>

          {/* Зураг — утасны камер шууд нээгдэнэ */}
          <label className="block">
            <span className="block text-xs uppercase tracking-wide text-ink-muted mb-2">
              {t('Баталгаажуулах зураг')}
              {success && ' *'}
            </span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onPickPhoto}
              className="block w-full text-sm text-ink-muted file:mr-3 file:py-2.5 file:px-4 file:rounded file:border-0 file:bg-accent file:text-accent-foreground file:text-base file:font-medium"
            />
          </label>
          {previewUrl && (
            <img
              src={previewUrl}
              alt=""
              className="w-full max-h-56 object-cover rounded border border-rule"
            />
          )}

          {/* Амжилтгүйн шалтгаан */}
          {!success && (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              required
              rows={2}
              placeholder={t('Шалтгаан бичнэ үү')}
              className="w-full bg-bg border border-rule rounded px-3 py-2.5 text-base focus:outline-none focus:border-ink-muted"
            />
          )}

          {error && (
            <p className="text-sm text-alarm border border-alarm rounded px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-3"
            >
              {t('Болих')}
            </Button>
            <Button
              onClick={handleSubmit}
              loading={submitting}
              disabled={!canSubmit}
              className="flex-1 py-3 text-base"
            >
              {t('Илгээх')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
