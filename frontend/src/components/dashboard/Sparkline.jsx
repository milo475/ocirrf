import { scaleLinear } from 'd3-scale'
import { line } from 'd3-shape'

/**
 * 13 долоо хоногийн жижиг муруй (DASHBOARD.md Алхам 5).
 * Трэнд буурч байвал alarm, эсрэг бол ink-muted өнгө.
 */
export default function Sparkline({ values, width = 80, height = 24 }) {
  if (!values || values.length < 2) return null

  const x = scaleLinear()
    .domain([0, values.length - 1])
    .range([2, width - 4])
  const min = Math.min(...values)
  const max = Math.max(...values)
  const y = scaleLinear()
    .domain(min === max ? [min - 1, max + 1] : [min, max])
    .range([height - 3, 3])

  const path = line()
    .x((_, i) => x(i))
    .y((v) => y(v))(values)

  const last = values[values.length - 1]
  const declining = last < values[0]
  const color = declining ? 'var(--color-alarm)' : 'var(--color-ink-muted)'

  return (
    <svg width={width} height={height} className="shrink-0" aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" />
      <circle cx={x(values.length - 1)} cy={y(last)} r="2" fill={color} />
    </svg>
  )
}
