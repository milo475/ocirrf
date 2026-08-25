import { median } from 'd3-array'
import { useLang } from '../../context/LanguageContext'
import { formatMoneyShort } from '../../lib/format'
import MetricCard from './MetricCard'

const FOUR_WEEKS_AGO = 8 // healthHistory[12]=одоо → [8]=4 долоо хоногийн өмнө

/** 4 багана: эрсдэлийн дүн, эрсдэлтэй тоо, медиан оноо, 30 хоногт нөхөх */
export default function StatRow({ products }) {
  const { t } = useLang()
  const atRiskNow = products.filter((p) => p.stockHealth < 50)
  const atRiskAgo = products.filter((p) => p.healthHistory[FOUR_WEEKS_AGO] < 50)

  const riskSumNow = atRiskNow.reduce((a, p) => a + p.monthlySales, 0)
  const riskSumAgo = atRiskAgo.reduce((a, p) => a + p.monthlySales, 0)
  const riskSumDeltaPct =
    riskSumAgo > 0 ? ((riskSumNow - riskSumAgo) / riskSumAgo) * 100 : null

  const countDelta = atRiskNow.length - atRiskAgo.length

  const medianNow = median(products, (p) => p.stockHealth) ?? 0
  const medianAgo = median(products, (p) => p.healthHistory[FOUR_WEEKS_AGO]) ?? 0
  const medianDelta = medianNow - medianAgo

  const in30 = new Date(Date.now() + 30 * 86_400_000)
  const restock30 = products.filter((p) => new Date(p.nextRestockDate) <= in30)
  const restock30Sum = restock30.reduce((a, p) => a + p.monthlySales, 0)

  const sign = (n, digits = 0) => `${n >= 0 ? '+' : ''}${n.toFixed(digits)}`

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 md:divide-x divide-rule">
      <MetricCard
        label={t('Эрсдэлд буй дүн')}
        value={formatMoneyShort(riskSumNow)}
        delta={
          riskSumDeltaPct === null
            ? { text: t('— 4 дол.хон'), direction: null }
            : {
                text: `${sign(riskSumDeltaPct, 1)}% ${t('/ 4 дол.хон')}`,
                direction: riskSumDeltaPct > 0 ? 'worse' : 'better',
              }
        }
      />
      <MetricCard
        label={t('Эрсдэлтэй бараа')}
        value={String(atRiskNow.length)}
        delta={{
          text: `${sign(countDelta)} ${t('/ 4 дол.хон')}`,
          direction: countDelta > 0 ? 'worse' : countDelta < 0 ? 'better' : null,
        }}
      />
      <MetricCard
        label={t('Дундаж оноо')}
        value={String(Math.round(medianNow))}
        delta={{
          text: `${sign(medianDelta, 1)} ${t('/ 4 дол.хон')}`,
          direction: medianDelta < 0 ? 'worse' : medianDelta > 0 ? 'better' : null,
        }}
      />
      <MetricCard
        label={t('30 хоногт нөхөх')}
        value={formatMoneyShort(restock30Sum)}
        sub={`${restock30.length} ${t('бараа')}`}
      />
    </div>
  )
}
