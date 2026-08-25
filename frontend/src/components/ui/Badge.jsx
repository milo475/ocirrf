/**
 * Статусын badge. OrderStatus-ийн 6 төлөв index.css-ийн
 * --color-status-* токенуудаар өнгөждөг.
 */
const STATUS = {
  NEW: { label: 'Шинэ', cls: 'text-status-new border-status-new/40 bg-status-new/12' },
  CONFIRMED: { label: 'Баталгаажсан', cls: 'text-status-confirmed border-status-confirmed/40 bg-status-confirmed/12' },
  PREPARING: { label: 'Бэлтгэж буй', cls: 'text-status-preparing border-status-preparing/40 bg-status-preparing/12' },
  READY: { label: 'Бэлэн', cls: 'text-status-ready border-status-ready/40 bg-status-ready/12' },
  COMPLETED: { label: 'Дууссан', cls: 'text-status-completed border-status-completed/40 bg-status-completed/12' },
  CANCELLED: { label: 'Цуцлагдсан', cls: 'text-status-cancelled border-status-cancelled/40 bg-status-cancelled/12' },
}

export const STATUS_LABELS = Object.fromEntries(
  Object.entries(STATUS).map(([k, v]) => [k, v.label]),
)

export default function Badge({ status, children, className = '' }) {
  const s = STATUS[status]
  return (
    <span
      className={`inline-flex items-center font-mono text-[11px] uppercase tracking-wide border rounded px-1.5 py-0.5 ${
        s ? s.cls : 'text-ink-muted border-rule bg-surface'
      } ${className}`}
    >
      {s ? s.label : children}
    </span>
  )
}
