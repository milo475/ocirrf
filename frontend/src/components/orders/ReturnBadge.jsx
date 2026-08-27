import { useLang } from '../../context/LanguageContext'

/** Буцаалтын байдал: PARTIAL шар / FULL улаан (null → юу ч харагдахгүй) */
export default function ReturnBadge({ state }) {
  const { t } = useLang()
  if (!state) return null
  const style =
    state === 'FULL'
      ? 'text-alarm border-alarm/40 bg-alarm/10'
      : 'text-status-preparing border-status-preparing/40 bg-status-preparing/12'
  return (
    <span
      className={`inline-flex font-mono text-[10px] uppercase tracking-wide border rounded px-1 py-0.5 ${style}`}
    >
      {t(state === 'FULL' ? 'ret.full' : 'ret.partial')}
    </span>
  )
}
