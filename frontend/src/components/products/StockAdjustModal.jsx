import { useState } from 'react'
import { useLang } from '../../context/LanguageContext'
import { api } from '../../lib/api'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Modal from '../ui/Modal'
import { useToast } from '../ui/Toast'

/** Үлдэгдэл гараар тохируулах — POST /api/stock/adjust */
export default function StockAdjustModal({ product, onClose, onDone }) {
  const toast = useToast()
  const { t } = useLang()
  const [qtyChange, setQtyChange] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await api('/stock/adjust', {
        method: 'POST',
        body: {
          productId: product.id,
          qtyChange: Number(qtyChange),
          reason: reason.trim(),
        },
      })
      toast.show(
        t('«{name}» үлдэгдэл: {qty} {unit}', {
          name: product.name,
          qty: res.product.stockQty,
          unit: product.unit ?? 'ш',
        }),
      )
      onDone()
    } catch (err) {
      setError(err.message) // талбарын доор inline
      toast.show(err.message, { type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const preview =
    qtyChange !== '' && !Number.isNaN(Number(qtyChange))
      ? product.stockQty + Number(qtyChange)
      : null

  return (
    <Modal
      open={!!product}
      onClose={onClose}
      title={`${t('Үлдэгдэл тохируулах')} — ${product.name}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="font-mono text-sm tabular-nums">
          {t('Одоогийн үлдэгдэл:')}{' '}
          <span className="text-ink">{product.stockQty}</span>
          {preview !== null && (
            <span className={preview < 0 ? 'text-alarm' : 'text-ink-muted'}>
              {' '}
              → {preview}
            </span>
          )}
        </p>
        <Input
          id="adj-qty"
          label={t('Өөрчлөлт (+ орлого / − зарлага)')}
          required
          type="number"
          step="1"
          value={qtyChange}
          onChange={(e) => setQtyChange(e.target.value)}
          placeholder="10 эсвэл -5"
          className="font-mono"
        />
        <Input
          id="adj-reason"
          label={t('Шалтгаан')}
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('Жишээ: агуулахын тооллого')}
        />
        {error && (
          <p className="text-sm text-alarm border border-alarm rounded px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t('Болих')}
          </Button>
          <Button type="submit" loading={submitting}>
            {t('Хадгалах')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
