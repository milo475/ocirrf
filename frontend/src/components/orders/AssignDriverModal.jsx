import { useEffect, useState } from 'react'
import { useLang } from '../../context/LanguageContext'
import { api } from '../../lib/api'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import Select from '../ui/Select'
import { useToast } from '../ui/Toast'

/**
 * Жолооч хуваарилах (ADMIN/MANAGER). Жолоочдын жагсаалт + ачааллыг
 * /api/dashboard/manager-ийн driverLoad-оос авдаг (MANAGER-т нээлттэй
 * цорын ганц эх сурвалж).
 */
export default function AssignDriverModal({ order, onClose, onDone }) {
  const { t } = useLang()
  const toast = useToast()
  const [drivers, setDrivers] = useState(null)
  const [driverId, setDriverId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api('/dashboard/manager')
      .then((d) => setDrivers(d.driverLoad))
      .catch((e) => setError(e.message))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await api(`/orders/${order.id}/assign-driver`, {
        method: 'PATCH',
        body: { driverId },
      })
      toast.show(t('Жолооч хуваарилагдлаа'))
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
      open={!!order}
      onClose={onClose}
      title={`${t('Жолооч хуваарилах')} — ${order.orderNo}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          id="assign-driver"
          label={t('Жолооч')}
          required
          value={driverId}
          onChange={(e) => setDriverId(e.target.value)}
        >
          <option value="">
            {drivers === null ? t('ачаалж байна…') : '—'}
          </option>
          {(drivers ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} — {d.active} {t('идэвхтэй хүргэлт')}
              {d.isAvailable === false ? ` ${t('(завгүй)')}` : ''}
            </option>
          ))}
        </Select>

        {error && (
          <p className="text-sm text-alarm border border-alarm rounded px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t('Болих')}
          </Button>
          <Button type="submit" loading={submitting} disabled={!driverId}>
            {t('Хуваарилах')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
