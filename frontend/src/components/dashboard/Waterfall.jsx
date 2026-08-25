import { scaleLinear } from 'd3-scale'
import { useLang } from '../../context/LanguageContext'

const ROW_H = 30
const LABEL_W = 138
const WIDTH = 380

/**
 * Хэвтээ waterfall: суурь 55 → driver бүр нэмэгдэж/хасагдаж → эцсийн оноо.
 * Инвариантаар эцсийн багана stockHealth-тэй яг таарна. Тэнхлэг 0–100.
 */
export default function Waterfall({ drivers, stockHealth }) {
  const { t } = useLang()
  const x = scaleLinear().domain([0, 100]).range([LABEL_W, WIDTH - 24])

  let cum = 55
  const rows = [
    { label: 'Суурь', from: 0, to: 55, kind: 'base' },
    ...drivers.map((d) => {
      const from = cum
      cum += d.points
      return {
        label: d.label,
        from,
        to: cum,
        points: d.points,
        kind: d.points >= 0 ? 'plus' : 'minus',
      }
    }),
    { label: 'Эцсийн оноо', from: 0, to: stockHealth, kind: 'final' },
  ]

  const fill = {
    base: 'var(--color-ink-muted)',
    plus: 'var(--color-safe)',
    minus: 'var(--color-alarm)',
    final: 'var(--color-ink)',
  }

  const height = rows.length * ROW_H + 24

  return (
    <svg width={WIDTH} height={height} className="block max-w-full">
      {/* Тэнхлэгийн шугамууд 0 / 40 / 55 / 100 */}
      {[0, 40, 55, 100].map((v) => (
        <g key={v}>
          <line
            x1={x(v)}
            x2={x(v)}
            y1={0}
            y2={rows.length * ROW_H}
            stroke="var(--color-rule)"
            strokeDasharray={v === 40 ? '3 3' : undefined}
            strokeWidth={1}
          />
          <text
            x={x(v)}
            y={rows.length * ROW_H + 14}
            textAnchor="middle"
            fontSize="9"
            className="font-mono"
            fill="var(--color-ink-muted)"
          >
            {v}
          </text>
        </g>
      ))}

      {rows.map((row, i) => {
        const y = i * ROW_H
        const x1 = x(Math.min(row.from, row.to))
        const w = Math.max(Math.abs(x(row.to) - x(row.from)), 1.5)
        return (
          <g key={row.label}>
            <text
              x={0}
              y={y + ROW_H / 2 + 3}
              fontSize="11"
              fill="var(--color-ink-muted)"
            >
              {t(row.label)}
            </text>
            <rect
              x={x1}
              y={y + 6}
              width={w}
              height={ROW_H - 12}
              rx={2}
              fill={fill[row.kind]}
              opacity={row.kind === 'base' ? 0.45 : 0.9}
            />
            <text
              x={x(Math.max(row.from, row.to)) + 5}
              y={y + ROW_H / 2 + 3}
              fontSize="10"
              className="font-mono"
              fill="var(--color-ink)"
            >
              {row.kind === 'base' || row.kind === 'final'
                ? row.to
                : `${row.points >= 0 ? '+' : ''}${row.points}`}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
