import { useEffect, useState } from 'react'
import { useLang } from '../../context/LanguageContext'
import { api } from '../../lib/api'
import DriverOptions, { splitByZone } from './DriverOptions'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import Select from '../ui/Select'
import { useToast } from '../ui/Toast'

/**
 * Жолооч хуваарилах. Жолоочдын жагсаалтыг GET /api/drivers-ээс авна —
 * тэр endpoint нь drivers.view ЭСВЭЛ orders.assign_driver-ийн аль нэгийг
 * шаардана. (Өмнө нь @Roles(MANAGER, ADMIN)-тай /api/dashboard/manager-ээс
 * уншдаг байсан тул orders.assign_driver override авсан OPERATOR-т товч
 * гарч ирээд dropdown хоосон, 403 алдаа өгдөг байв.)
 */
export default function AssignDriverModal({ order, onClose, onDone }) {
  const { t } = useLang()
  const toast = useToast()
  const [drivers, setDrivers] = useState(null)
  const [driverId, setDriverId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api('/drivers')
      .then((list) => setDrivers(list.filter((d) => d.isActive)))
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

  // ОН захиалга ачааны тээврээр явдаг тул текст өөр — үйлдэл адилхан
  const oronNutag = order.region === 'ORON_NUTAG'

  // Сонгосон жолоочийн бүс захиалгын дүүрэгтэй таарч байна уу
  const offZone =
    !oronNutag &&
    driverId &&
    splitByZone(drivers ?? [], [order.district]).matched.every(
      (d) => d.id !== driverId,
    )

  return (
    <Modal
      open={!!order}
      onClose={onClose}
      title={`${oronNutag ? t('Тээвэрт гаргах') : t('Жолооч хуваарилах')} — ${order.orderNo}`}
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
          <DriverOptions
            drivers={drivers}
            districts={oronNutag ? [] : [order.district]}
          />
        </Select>

        {/* Бүс нь таарахгүй жолооч сонговол сануулна — хориглохгүй */}
        {offZone && (
          <p className="text-sm text-status-preparing border border-status-preparing/40 rounded px-3 py-2">
            {t('Энэ жолоочийн харьяалах бүсэд {d} ороогүй байна', {
              d: order.district,
            })}
          </p>
        )}

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
            {oronNutag ? t('Тээвэрт гаргах') : t('Хуваарилах')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
