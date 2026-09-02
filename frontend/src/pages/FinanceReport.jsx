import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Spinner from '../components/ui/Spinner'
import { useToast } from '../components/ui/Toast'
import { useLang } from '../context/LanguageContext'
import { api, apiBlob } from '../lib/api'
import { formatMoneyRound } from '../lib/format'

/**
 * ОРЛОГО ТАЙЛАН — нягтланд өгөх үндсэн тайлан (V5).
 *
 * Мөнгөн урсгалаас ЯЛГААТАЙ: борлуулалт нь ЗАХИАЛГААС гарна (төлсөн
 * эсэхээс үл хамааран), зардал нь бүртгэсэн гүйлгээнээс. Бараа
 * худалдан авалт ба буцаалт нь тайланд ОРОХГҮЙ — эхнийх нь бараа
 * болж хувирдаг (зарагдахдаа ЗБӨ болно), хоёр дахь нь борлуулалтаас
 * аль хэдийн хасагдсан. Хоёуланг нь тоовол тоо давхардана.
 */

/** Өнөөдрөөс N хоногийн өмнөх огноо — YYYY-MM-DD */
function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
const today = () => new Date().toISOString().slice(0, 10)

/** Тайлангийн нэг мөр — гарчиг бол тодоор, дэд мөр бол сааралдуу */
function Row({ label, value, strong, muted, negative }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-2 ${
        strong ? 'border-t border-rule font-medium' : ''
      }`}
    >
      <span className={muted ? 'text-sm text-ink-muted pl-4' : 'text-sm'}>
        {label}
      </span>
      <span
        className={`font-mono tabular-nums shrink-0 ${
          strong ? 'text-lg' : 'text-sm'
        } ${negative ? 'text-ink-muted' : ''}`}
      >
        {negative ? '−' : ''}
        {formatMoneyRound(value)}
      </span>
    </div>
  )
}

export default function FinanceReport() {
  const { t } = useLang()
  const toast = useToast()
  const [from, setFrom] = useState(daysAgo(29))
  const [to, setTo] = useState(today())
  const [data, setData] = useState(null)
  const [position, setPosition] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setError(null)
    Promise.all([
      api(`/finance/pnl?from=${from}&to=${to}`),
      api('/finance/position'),
    ])
      .then(([p, pos]) => {
        setData(p)
        setPosition(pos)
      })
      .catch(setError)
  }, [from, to])

  useEffect(() => {
    load()
  }, [load])

  async function download() {
    setBusy(true)
    try {
      const { blob, filename } = await apiBlob(
        `/reports/pnl.csv?from=${from}&to=${to}`,
      )
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      toast.show(t('Тайлан татагдлаа'))
    } catch (e) {
      toast.show(e.message, { type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Link to="/finance" className="text-sm text-ink-muted hover:text-ink">
        ← {t('Санхүү')}
      </Link>

      <div className="mt-4 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-4xl font-medium">{t('Орлого тайлан')}</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {t('Нягтланд өгөх тайлан — борлуулалт, өртөг, зардал, ашиг')}
          </p>
        </div>
        <Button onClick={download} loading={busy}>
          {t('Excel-д татах')}
        </Button>
      </div>

      <div className="mt-8 flex gap-3 items-end flex-wrap">
        <Input
          id="pnl-from"
          label={t('Эхлэх')}
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="font-mono"
        />
        <Input
          id="pnl-to"
          label={t('Дуусах')}
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="font-mono"
        />
        <div className="flex gap-1">
          {[
            [t('Энэ сар'), () => [daysAgo(new Date().getDate() - 1), today()]],
            [t('30 хоног'), () => [daysAgo(29), today()]],
            [t('90 хоног'), () => [daysAgo(89), today()]],
          ].map(([label, fn]) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                const [f, tt] = fn()
                setFrom(f)
                setTo(tt)
              }}
              className="px-2.5 py-1.5 text-xs rounded border border-rule text-ink-muted hover:text-ink hover:border-ink-muted"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="mt-8 text-sm text-alarm border border-alarm rounded px-3 py-2">
          {error.message}
        </p>
      ) : !data ? (
        <div className="mt-16 flex justify-center">
          <Spinner />
        </div>
      ) : (
        <>
          {/* Өртөггүй бараа байвал ашиг ХУУРАМЧ гарна — чимээгүй өнгөрч
              болохгүй тул тайлангийн ДЭЭР анхааруулна */}
          {position?.productsWithoutCost > 0 && (
            <div className="mt-8 border border-alarm/50 bg-alarm/8 rounded-lg px-4 py-3">
              <p className="text-sm font-medium">
                ⚠ {position.productsWithoutCost} {t('бараа өртөггүй байна')}
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                {t(
                  'Тэдгээрийн зарсан барааны өртөг 0 гэж тооцогдох тул ашиг БОДИТООС ӨНДӨР харагдана. Бараа хуудсаас өртгийг нь оруулна уу.',
                )}
              </p>
            </div>
          )}

          <section className="mt-8 max-w-xl">
            <Row label={t('Борлуулалт')} value={data.revenue} />
            <Row
              label={t('Зарсан барааны өртөг')}
              value={data.cogs}
              negative
              muted
            />
            <Row label={t('НИЙТ АШИГ')} value={data.grossProfit} strong />

            {Number(data.otherIncome) !== 0 && (
              <Row label={t('Бусад орлого')} value={data.otherIncome} muted />
            )}

            {data.expenses.length > 0 && (
              <p className="mt-5 text-xs uppercase tracking-wide text-ink-muted">
                {t('Үйл ажиллагааны зардал')}
              </p>
            )}
            {data.expenses.map((e) => (
              <Row key={e.label} label={e.label} value={e.amount} negative muted />
            ))}
            <Row
              label={t('Зардлын дүн')}
              value={data.expenseTotal}
              negative
              strong
            />

            <div className="mt-2 border-t-2 border-ink pt-3 flex items-baseline justify-between gap-4">
              <span className="font-medium">{t('ЦЭВЭР АШИГ')}</span>
              <span
                className={`font-mono tabular-nums text-2xl ${
                  Number(data.netProfit) < 0 ? 'text-alarm' : 'text-safe'
                }`}
              >
                {formatMoneyRound(data.netProfit)}
              </span>
            </div>
          </section>

          {data.excluded.length > 0 && (
            <section className="mt-10 max-w-xl border border-rule rounded-lg p-4">
              <p className="text-xs uppercase tracking-wide text-ink-muted">
                {t('Тайланд ороогүй мөнгөн гүйлгээ')}
              </p>
              <p className="mt-2 text-sm text-ink-muted">
                {t(
                  'Эдгээр нь мөнгөн урсгалд орсон ч тайланд ОРОХГҮЙ: бараа худалдан авалт нь зарагдахдаа өртөг болно, төлбөр ба буцаалт нь борлуулалтад аль хэдийн тусгагдсан. Хоёуланг нь тоовол давхардана.',
                )}
              </p>
              <div className="mt-3">
                {data.excluded.map((e) => (
                  <Row key={e.label} label={e.label} value={e.amount} muted />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
