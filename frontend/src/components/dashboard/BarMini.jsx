import { scaleLinear } from 'd3-scale'

/**
 * 7 хоногийн жижиг баганан график. Нэг эсвэл хоёр цуваа (зэрэгцээ багана).
 * values2 өгвөл хос багана (жишээ: орлого/зарлага, үүсгэсэн/хүргэсэн).
 */
export default function BarMini({
  values,
  values2,
  width = 160,
  height = 40,
  color = 'var(--color-accent)',
  color2 = 'var(--color-ink-muted)',
  labels,
}) {
  if (!values || values.length === 0) return null

  const max = Math.max(...values, ...(values2 ?? []), 1)
  const y = scaleLinear().domain([0, max]).range([0, height - 4])

  const n = values.length
  const groupW = width / n
  const barW = values2 ? Math.max((groupW - 6) / 2, 2) : Math.max(groupW - 6, 3)

  return (
    <svg
      width={width}
      height={height + (labels ? 12 : 0)}
      className="block"
      aria-hidden="true"
    >
      {values.map((v, i) => {
        const x0 = i * groupW + 3
        return (
          <g key={i}>
            <rect
              x={x0}
              y={height - y(v)}
              width={barW}
              height={Math.max(y(v), v > 0 ? 2 : 0.5)}
              rx="1"
              fill={color}
              opacity="0.9"
            />
            {values2 && (
              <rect
                x={x0 + barW + 2}
                y={height - y(values2[i] ?? 0)}
                width={barW}
                height={Math.max(y(values2[i] ?? 0), (values2[i] ?? 0) > 0 ? 2 : 0.5)}
                rx="1"
                fill={color2}
                opacity="0.7"
              />
            )}
            {labels && (
              <text
                x={x0 + (values2 ? barW : barW / 2)}
                y={height + 10}
                textAnchor="middle"
                fontSize="8"
                className="font-mono"
                fill="var(--color-ink-muted)"
              >
                {labels[i]}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
