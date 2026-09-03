/** Серверийн buildLineChart өгөгдлөөс SVG шугаман график (Studexa-гийн ижил) */
export default function LineChart({ chart, lastLabel = 'Сүүлийн оноо:' , empty }) {
  if (!chart) {
    return <div className="border border-dashed border-rule rounded py-10 text-center text-sm text-ink-muted">{empty}</div>
  }
  return (
    <div>
      <svg viewBox={`0 0 ${chart.width} ${chart.height}`} width="100%" height={chart.height}>
        <polyline
          points={chart.points}
          fill="none"
          stroke="#4f46e5"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {chart.dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r="4" fill="#4f46e5" />
        ))}
      </svg>
      <div className="flex justify-between text-[11px] text-ink-muted">
        <span>{chart.firstLabel}</span>
        <span>
          {lastLabel} <b className="text-accent">{chart.lastValue}%</b>
        </span>
        <span>{chart.lastLabel}</span>
      </div>
    </div>
  )
}
