import { useState } from 'react'
import { api } from '../../lib/api'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Modal from '../ui/Modal'
import { useToast } from '../ui/Toast'

/** Үлдэгдэл гараар тохируулах — POST /api/stock/adjust */
export default function StockAdjustModal({ product, onClose, onDone }) {
  const toast = useToast()
  const [qtyChange, setQtyChange] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
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
        `«${product.name}» үлдэгдэл: ${res.product.stockQty} ${product.unit ?? 'ш'}`,
      )
      onDone()
    } catch (err) {
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
      title={`Үлдэгдэл тохируулах — ${product.name}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="font-mono text-sm tabular-nums">
          Одоогийн үлдэгдэл:{' '}
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
          label="Өөрчлөлт (+ орлого / − зарлага)"
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
          label="Шалтгаан"
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Жишээ: агуулахын тооллого"
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Болих
          </Button>
          <Button type="submit" loading={submitting}>
            Хадгалах
          </Button>
        </div>
      </form>
    </Modal>
  )
}
