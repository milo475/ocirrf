import { useLang } from '../../context/LanguageContext'
import { formatMoneyShort } from '../../lib/format'
import {
  daysSince,
  drawdown,
  exposure,
  runwayWeeks,
  wowDelta,
} from '../../lib/metrics'
import Sparkline from './Sparkline'

const alarmIf = (cond) => (cond ? 'text-alarm' : '')

function buildRow(p) {
  const dd = drawdown(p.healthHistory)
  const runway = runwayWeeks(p.healthHistory)
  const wow = wowDelta(p.healthHistory)
  const restockDays = daysSince(p.lastRestocked)
  return { p, dd, runway, wow, restockDays }
}

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-CA', { month: '2-digit', day: '2-digit' })

/** exposure оноогоор эрэмбэлсэн дээд 8 эрсдэлтэй бараа (DASHBOARD.md Алхам 10) */
export default function Watchlist({ products, selectedId, onSelect }) {
  const { t } = useLang()
  const rows = [...products]
    .sort((a, b) => exposure(b) - exposure(a))
    .slice(0, 8)
    .map(buildRow)

  return (
    <div>
      {/* Хүснэгт (md ба түүнээс дээш) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-ink-muted border-b border-rule">
              <th className="text-left font-normal py-2 pr-3">{t('Бараа')}</th>
              <th className="text-right font-normal py-2 px-3">{t('Сарын борл.')}</th>
              <th className="text-right font-normal py-2 px-3">{t('Оноо')}</th>
              <th className="text-left font-normal py-2 px-3">{t('13 дол.хон')}</th>
              <th className="text-right font-normal py-2 px-3">{t('Уналт')}</th>
              <th className="text-right font-normal py-2 px-3">{t('stock.runway')}</th>
              <th className="text-right font-normal py-2 px-3">{t('Эргэц')}</th>
              <th className="text-right font-normal py-2 px-3">{t('7 хон. Δ')}</th>
              <th className="text-right font-normal py-2 px-3">{t('Сүүлд нөхсөн')}</th>
              <th className="text-right font-normal py-2 pl-3">{t('Дараагийн')}</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {rows.map(({ p, dd, runway, wow, restockDays }) => (
              <tr
                key={p.id}
                onClick={() => onSelect(p)}
                className={`border-b border-rule cursor-pointer hover:bg-surface transition-colors ${
                  selectedId === p.id ? 'bg-surface' : ''
                }`}
              >
                <td className="py-2.5 pr-3 font-sans">
                  {p.name}
                  <span className="ml-2 text-xs text-ink-muted">
                    {p.category}
                  </span>
                </td>
                <td className="text-right px-3">
                  {formatMoneyShort(p.monthlySales)}
                </td>
                <td className={`text-right px-3 ${alarmIf(p.stockHealth < 40)}`}>
                  {p.stockHealth}
                </td>
                <td className="px-3">
                  <Sparkline values={p.healthHistory} />
                </td>
                <td className={`text-right px-3 ${alarmIf(dd > 15)}`}>
                  {dd.toFixed(0)}%
                </td>
                <td className={`text-right px-3 ${alarmIf(runway < 8)}`}>
                  {runway === Infinity ? '∞' : `${Math.round(runway)}${t('дх')}`}
                </td>
                <td
                  className={`text-right px-3 ${alarmIf(
                    p.turnoverRate !== null && p.turnoverRate < 0.3,
                  )}`}
                >
                  {p.turnoverRate === null
                    ? '—'
                    : `${Math.round(p.turnoverRate * 100)}%`}
                </td>
                <td className={`text-right px-3 ${alarmIf(wow < 0)}`}>
                  {wow >= 0 ? '+' : ''}
                  {wow}
                </td>
                <td className={`text-right px-3 ${alarmIf(restockDays > 30)}`}>
                  {restockDays}{t('хон')}
                </td>
                <td className="text-right pl-3">{fmtDate(p.nextRestockDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Утсан дээр карт (DASHBOARD.md Алхам 12) */}
      <div className="md:hidden space-y-3">
        {rows.map(({ p, dd, runway, wow, restockDays }) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p)}
            className="w-full text-left bg-surface border border-rule rounded p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <span>{p.name}</span>
              <span
                className={`font-mono ${alarmIf(p.stockHealth < 40)}`}
              >
                {p.stockHealth}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <Sparkline values={p.healthHistory} />
              <span className="font-mono text-xs text-ink-muted tabular-nums">
                {formatMoneyShort(p.monthlySales)} ·{' '}
                <span className={alarmIf(dd > 15)}>↓{dd.toFixed(0)}%</span> ·{' '}
                <span className={alarmIf(runway < 8)}>
                  {runway === Infinity ? '∞' : `${Math.round(runway)}${t('дх')}`}
                </span>{' '}
                ·{' '}
                <span className={alarmIf(wow < 0)}>
                  {wow >= 0 ? '+' : ''}
                  {wow}
                </span>{' '}
                · <span className={alarmIf(restockDays > 30)}>{restockDays}х</span>
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
