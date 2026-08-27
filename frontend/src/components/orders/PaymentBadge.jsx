import { useLang } from '../../context/LanguageContext'

/** Төлбөрийн статус: Төлөөгүй улаан / Хэсэгчлэн шар / Төлсөн ногоон */
export default function PaymentBadge({ status }) {
  const { t } = useLang()
  const style =
    status === 'PAID'
      ? 'text-safe border-safe/40 bg-safe/12'
      : status === 'PARTIAL'
        ? 'text-status-preparing border-status-preparing/40 bg-status-preparing/12'
        : 'text-alarm border-alarm/40 bg-alarm/10'
  const label =
    status === 'PAID' ? 'Төлсөн' : status === 'PARTIAL' ? 'Хэсэгчлэн' : 'Төлөөгүй'
  return (
    <span
      className={`inline-flex font-mono text-[10px] uppercase tracking-wide border rounded px-1 py-0.5 ${style}`}
    >
      {t(label)}
    </span>
  )
}
