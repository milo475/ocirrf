import { useEffect, useRef, useState } from 'react'
import { useLang } from '../../context/LanguageContext'
import { api } from '../../lib/api'
import { formatMoney } from '../../lib/format'

/**
 * Бараа хайх combobox: нэр/SKU-гээр хайж, сонгоход onPick(product)
 * дуудагдана. excludeIds — аль хэдийн нэмэгдсэн. endpoint — portal
 * горимд /portal/products (хязгаарлагдмал талбартай) руу чиглэнэ.
 */
export default function ProductPicker({
  onPick,
  excludeIds = [],
  endpoint = '/products',
}) {
  const { t } = useLang()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const boxRef = useRef(null)

  // Barcode скан (V4-12) — BarcodeDetector дэмждэг browser-т л товч гарна
  const scanSupported =
    typeof window !== 'undefined' && 'BarcodeDetector' in window
  const [scanOpen, setScanOpen] = useState(false)

  // Debounce хайлт
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      setOpen(false)
      return
    }
    const t = setTimeout(() => {
      api(`${endpoint}?search=${encodeURIComponent(q)}&limit=8`)
        .then((d) => {
          setResults(d.items)
          setOpen(true)
          setActive(0)
        })
        .catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [query, endpoint])

  // Гадна дарахад хаагдана
  useEffect(() => {
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  function pick(p) {
    onPick(p)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  function onKeyDown(e) {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const p = results[active]
      if (p && !excludeIds.includes(p.id)) pick(p)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={t('Бараа хайх — нэр эсвэл SKU…')}
        className={`w-full bg-bg border border-rule rounded px-3 py-2 text-sm focus:outline-none focus:border-ink-muted ${scanSupported ? 'pr-10' : ''}`}
        role="combobox"
        aria-expanded={open}
      />
      {scanSupported && (
        <button
          type="button"
          onClick={() => setScanOpen(true)}
          aria-label={t('Barcode скан')}
          title={t('Barcode скан')}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-lg leading-none"
        >
          📷
        </button>
      )}
      {scanOpen && (
        <BarcodeScanOverlay
          t={t}
          onClose={() => setScanOpen(false)}
          onDetect={(code) => {
            setScanOpen(false)
            setQuery(code)
          }}
        />
      )}
      {open && (
        <ul className="absolute z-30 mt-1 w-full bg-surface border border-rule rounded shadow-lg max-h-72 overflow-y-auto">
          {results.length === 0 && (
            <li className="px-3 py-2 text-sm text-ink-muted">{t('Олдсонгүй')}</li>
          )}
          {results.map((p, i) => {
            const added = excludeIds.includes(p.id)
            const out = p.stockQty === 0
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={added || out}
                  onClick={() => pick(p)}
                  onMouseEnter={() => setActive(i)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-baseline justify-between gap-3 disabled:opacity-40 ${
                    i === active ? 'bg-bg' : ''
                  }`}
                >
                  <span>
                    {p.name}
                    <span className="font-mono text-xs text-ink-muted ml-2">
                      {p.sku}
                    </span>
                    {added && (
                      <span className="text-xs text-ink-muted ml-2">
                        {t('— нэмэгдсэн')}
                      </span>
                    )}
                    {out && !added && (
                      <span className="inline-flex ml-2 font-mono text-[10px] uppercase tracking-wide border rounded px-1 py-0.5 text-status-cancelled border-status-cancelled/40 bg-status-cancelled/12">
                        {t('stock.out')}
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-xs text-ink-muted tabular-nums shrink-0">
                    {formatMoney(p.price)} · {p.stockQty}ш
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/**
 * Утасны камераар barcode уншина (V4-12). BarcodeDetector API —
 * Chrome/Android дээр ажиллана; олдсон кодыг хайлтад тавина.
 */
function BarcodeScanOverlay({ onDetect, onClose, t }) {
  const videoRef = useRef(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let stream = null
    let timer = null
    let stopped = false
    const detector = new window.BarcodeDetector()

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        if (stopped) {
          s.getTracks().forEach((tr) => tr.stop())
          return
        }
        stream = s
        videoRef.current.srcObject = s
        return videoRef.current.play().then(() => {
          timer = setInterval(async () => {
            try {
              const codes = await detector.detect(videoRef.current)
              if (codes.length > 0) onDetect(codes[0].rawValue)
            } catch {
              /* бэлэн биш хүрээг алгасна */
            }
          }, 300)
        })
      })
      .catch((e) => setErr(e.message))

    return () => {
      stopped = true
      clearInterval(timer)
      stream?.getTracks().forEach((tr) => tr.stop())
    }
  }, [onDetect])

  return (
    <div className="fixed inset-0 z-50 bg-bg/90 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-surface border border-rule rounded-lg p-4 space-y-3">
        <p className="text-sm text-ink-muted">{t('Barcode-ыг камерт ойртуулна уу')}</p>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} playsInline muted className="w-full rounded bg-bg aspect-video" />
        {err && (
          <p className="text-sm text-alarm border border-alarm rounded px-3 py-2">{err}</p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="w-full border border-rule rounded py-2 text-sm text-ink-muted hover:text-ink"
        >
          {t('Болих')}
        </button>
      </div>
    </div>
  )
}
