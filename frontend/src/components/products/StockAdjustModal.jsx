import { useState } from 'react'
import { useLang } from '../../context/LanguageContext'
import { api } from '../../lib/api'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Modal from '../ui/Modal'
import Select from '../ui/Select'
import { useToast } from '../ui/Toast'

/** Орлого/зарлага — POST /api/stock/adjust (v2: reason төрөлтэй) */
export default function StockAdjustModal({ product, onClose, onDone }) {
  const toast = useToast()
  const { t } = useLang()
  const [type, setType] = useState('PURCHASE_IN')
  const [qty, setQty] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  /**
   * Хэрэглэгч эерэг тоо оруулна; тэмдгийг төрөл нь тодорхойлно.
   * CORRECTION үед сөрөг тоо шууд бичиж болно (+/- аль ч чиглэл).
   */
  const n = Number(qty)
  const qtyChange = Number.isNaN(n)
    ? 0
    : type === 'MANUAL_OUT'
      ? -Math.abs(n)
      : type === 'PURCHASE_IN'
        ? Math.abs(n)
        : n

  const preview =
    qty !== '' && !Number.isNaN(n) ? product.stockQty + qtyChange : null

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await api('/stock/adjust', {
        method: 'POST',
        body: {
          productId: product.id,
          qtyChange,
          reason: type,
          ...(type === 'PURCHASE_IN' && unitCost.trim()
            ? { unitCost: unitCost.trim() }
            : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
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
      setError(err.message)
      toast.show(err.message, { type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={!!product}
      onClose={onClose}
      title={`${t('Орлого/Зарлага')} — ${product.name}`}
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

        <Select
          id="adj-type"
          label={t('Төрөл')}
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="PURCHASE_IN">{t('Орлого')} (+)</option>
          <option value="MANUAL_OUT">{t('Зарлага')} (−)</option>
          <option value="CORRECTION">{t('Залруулга')} (±)</option>
        </Select>

        <Input
          id="adj-qty"
          label={t('Тоо ширхэг')}
          required
          type="number"
          step="1"
          min={type === 'CORRECTION' ? undefined : '1'}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder={type === 'CORRECTION' ? '5 эсвэл -5' : '10'}
          className="font-mono"
        />

        {/* Орлогод нэгжийн өртөг — барааны costPrice шинэчлэгдэнэ (v4) */}
        {type === 'PURCHASE_IN' && (
          <Input
            id="adj-cost"
            label={t('Нэгжийн өртөг (₮)')}
            inputMode="decimal"
            pattern="\d{1,10}(\.\d{1,2})?"
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
            placeholder={t('(заавал биш)')}
            className="font-mono"
          />
        )}

        <Input
          id="adj-note"
          label={t('Тэмдэглэл')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
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
