import { max } from 'd3-array'
import { scaleLinear, scaleSqrt } from 'd3-scale'
import { useEffect, useMemo, useRef, useState } from 'react'
import { computeBeeswarm, healthColor } from '../../lib/beeswarm'
import { formatMoneyShort } from '../../lib/format'

const PAD_X = 16
const CAPTION_H = 22
const BAND_GAP = 12
const MIN_CHART_WIDTH = 640 // утсан дээр хэвтээ гүйлгэнэ

function useContainerWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

export default function BeeswarmChart({
  products,
  view,
  filter,
  selectedId,
  onSelect,
}) {
  const [containerRef, containerWidth] = useContainerWidth()
  const width = Math.max(containerWidth, MIN_CHART_WIDTH)
  const [tooltip, setTooltip] = useState(null)

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category))],
    [products],
  )

  // Хүнд тооцоолол — зөвхөн өгөгдөл/өргөн/харагдац өөрчлөгдөхөд
  const { bands, totalHeight, xScale } = useMemo(() => {
    if (!containerWidth) return { bands: [], totalHeight: 0, xScale: null }

    // clamp: 10-аас доош оноотой бараа (жишээ нь 0) зүүн захад наалдана —
    // үгүй бол domain-аас гадуур экстраполяци хийж дэлгэцээс гарчихна
    const x = scaleLinear()
      .domain([10, 100])
      .range([PAD_X + 18, width - PAD_X])
      .clamp(true)
    const r = scaleSqrt()
      .domain([0, max(products, (p) => p.monthlySales) ?? 1])
      .range([3, 18])

    const groups =
      view === 'segment'
        ? categories.map((c) => ({
            label: c,
            items: products.filter((p) => p.category === c),
          }))
        : [{ label: null, items: products }]

    let y0 = 0
    const bandList = groups.map((g) => {
      const nodes = computeBeeswarm(g.items, {
        xOf: (p) => x(p.stockHealth),
        rOf: (p) => r(p.monthlySales),
      })
      // Зурвасын өндөр нь swarm-ийн бодит тархалтаас (хатуу тоо биш)
      const maxDev = max(nodes, (n) => Math.abs(n.y) + n.r) ?? 20
      const half = Math.max(maxDev + 10, 30)
      const captionH = g.label ? CAPTION_H : 0
      const band = {
        ...g,
        nodes,
        center: y0 + captionH + half,
        top: y0,
        captionH,
        height: captionH + half * 2,
      }
      y0 += band.height + BAND_GAP
      return band
    })

    return { bands: bandList, totalHeight: y0 - BAND_GAP + 24, xScale: x }
  }, [products, containerWidth, width, view, categories])

  function showTooltip(e, p) {
    setTooltip({ x: e.clientX, y: e.clientY, p })
  }

  return (
    <div ref={containerRef} className="overflow-x-auto">
      {/* Өргөн хараахан хэмжигдээгүй бол зурахгүй (DASHBOARD.md-ийн анхааруулга) */}
      {containerWidth > 0 && (
        <svg width={width} height={totalHeight} className="block">
          {/* Эрсдэлийн босго x=40 */}
          <line
            x1={xScale(40)}
            x2={xScale(40)}
            y1={0}
            y2={totalHeight - 18}
            stroke="var(--color-rule)"
            strokeDasharray="4 4"
          />
          <text
            x={xScale(40)}
            y={totalHeight - 4}
            textAnchor="middle"
            className="font-mono"
            fontSize="10"
            fill="var(--color-ink-muted)"
          >
            эрсдэлийн босго
          </text>

          {bands.map((band) => (
            <g key={band.label ?? 'combined'}>
              {band.label && (
                <text
                  x={PAD_X}
                  y={band.top + 13}
                  className="font-mono"
                  fontSize="11"
                  fill="var(--color-ink-muted)"
                >
                  {band.label} · {band.items.length} бараа ·{' '}
                  {formatMoneyShort(
                    band.items.reduce((a, p) => a + p.monthlySales, 0),
                  )}
                </text>
              )}
              {band.nodes.map((n) => {
                const p = n.data
                const dimmed = filter && p.category !== filter
                const isSelected = selectedId === p.id
                return (
                  <circle
                    key={p.id}
                    cx={n.x}
                    cy={band.center + n.y}
                    r={n.r}
                    fill={healthColor(p.stockHealth)}
                    opacity={dimmed ? 0.2 : 0.9}
                    stroke={isSelected ? 'var(--color-ink)' : 'none'}
                    strokeWidth={isSelected ? 2 : 0}
                    tabIndex={dimmed ? -1 : 0}
                    role="button"
                    aria-label={`${p.name}, оноо ${p.stockHealth}`}
                    className="cursor-pointer focus:outline-none focus-visible:stroke-ink"
                    onClick={() => onSelect(p)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onSelect(p)
                    }}
                    onMouseEnter={(e) => showTooltip(e, p)}
                    onMouseMove={(e) => showTooltip(e, p)}
                    onMouseLeave={() => setTooltip(null)}
                  />
                )
              })}
            </g>
          ))}
        </svg>
      )}

      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 bg-surface border border-rule rounded px-3 py-2 shadow-lg"
          style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
        >
          <p className="font-serif text-sm">{tooltip.p.name}</p>
          <p className="font-mono text-xs text-ink-muted mt-0.5 tabular-nums">
            оноо {tooltip.p.stockHealth} ·{' '}
            {formatMoneyShort(tooltip.p.monthlySales)} · {tooltip.p.category}
          </p>
        </div>
      )}
    </div>
  )
}
