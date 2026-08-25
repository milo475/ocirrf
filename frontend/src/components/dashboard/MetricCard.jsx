/**
 * Нэг статистик карт: жижиг uppercase гарчиг, том mono тоо, delta мөр.
 * delta.direction: 'worse' → alarm, 'better' → safe, бусад нь muted.
 */
export default function MetricCard({ label, value, delta, sub }) {
  const deltaColor =
    delta?.direction === 'worse'
      ? 'text-alarm'
      : delta?.direction === 'better'
        ? 'text-safe'
        : 'text-ink-muted'

  return (
    <div className="px-6 first:pl-0 last:pr-0">
      <p className="text-xs uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-2 font-mono text-3xl tabular-nums">{value}</p>
      {delta && (
        <p className={`mt-1 font-mono text-sm tabular-nums ${deltaColor}`}>
          {delta.text}
        </p>
      )}
      {sub && <p className="mt-1 text-sm text-ink-muted">{sub}</p>}
    </div>
  )
}
