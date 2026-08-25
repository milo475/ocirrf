import { useLang } from '../../context/LanguageContext'

/**
 * Статусын badge. OrderStatus-ийн 6 төлөв index.css-ийн
 * --color-status-* токенуудаар өнгөждөг.
 */
const STATUS = {
  // OrderStatus (6)
  NEW: { label: 'Шинэ', cls: 'text-status-new border-status-new/40 bg-status-new/12' },
  CONFIRMED: { label: 'Баталгаажсан', cls: 'text-status-confirmed border-status-confirmed/40 bg-status-confirmed/12' },
  PREPARING: { label: 'Бэлтгэж буй', cls: 'text-status-preparing border-status-preparing/40 bg-status-preparing/12' },
  READY: { label: 'Бэлэн', cls: 'text-status-ready border-status-ready/40 bg-status-ready/12' },
  COMPLETED: { label: 'Дууссан', cls: 'text-status-completed border-status-completed/40 bg-status-completed/12' },
  CANCELLED: { label: 'Цуцлагдсан', cls: 'text-status-cancelled border-status-cancelled/40 bg-status-cancelled/12' },
  // DeliveryStatus (5) — нэрс OrderStatus-тай давхардахгүй тул нэг map-д
  PENDING: { label: 'Хүлээгдэж буй', cls: 'text-delivery-pending border-delivery-pending/40 bg-delivery-pending/12' },
  ASSIGNED: { label: 'Хуваарилагдсан', cls: 'text-delivery-assigned border-delivery-assigned/40 bg-delivery-assigned/12' },
  ON_THE_WAY: { label: 'Замд яваа', cls: 'text-delivery-ontheway border-delivery-ontheway/40 bg-delivery-ontheway/12' },
  DELIVERED: { label: 'Хүргэгдсэн', cls: 'text-delivery-delivered border-delivery-delivered/40 bg-delivery-delivered/12' },
  FAILED: { label: 'Амжилтгүй', cls: 'text-delivery-failed border-delivery-failed/40 bg-delivery-failed/12' },
}

export const STATUS_LABELS = Object.fromEntries(
  Object.entries(STATUS).map(([k, v]) => [k, v.label]),
)

export default function Badge({ status, children, className = '' }) {
  const { t } = useLang()
  const s = STATUS[status]
  return (
    <span
      className={`inline-flex items-center font-mono text-[11px] uppercase tracking-wide border rounded px-1.5 py-0.5 ${
        s ? s.cls : 'text-ink-muted border-rule bg-surface'
      } ${className}`}
    >
      {s ? t(s.label) : children}
    </span>
  )
}
