import { useEffect, useRef, useState } from 'react'
import { useLang } from '../../context/LanguageContext'

/**
 * Дэлгэц дээр гарын үсэг зурах талбар (V5).
 * Хулгана болон хуруу (pointer events) хоёуланг дэмжинэ. Утгыг PNG
 * data URL болгож эцэг компонент руу өгнө — хүлээлгэн өгөх хуудсанд
 * хадгалагдаж, хэвлэхэд шууд харагдана.
 */
export default function SignaturePad({ label, onChange }) {
  const { t } = useLang()
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const [empty, setEmpty] = useState(true)

  // Дэлгэцийн нягтралд тохируулна — эс тэгвэл зураас бүдгэрнэ
  useEffect(() => {
    const canvas = canvasRef.current
    const ratio = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * ratio
    canvas.height = rect.height * ratio
    const ctx = canvas.getContext('2d')
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#111111'
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, rect.width, rect.height)
  }, [])

  const pos = (e) => {
    const r = canvasRef.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function start(e) {
    e.preventDefault()
    drawing.current = true
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = pos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function move(e) {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = pos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    if (empty) setEmpty(false)
  }

  function end() {
    if (!drawing.current) return
    drawing.current = false
    onChange(canvasRef.current.toDataURL('image/png'))
  }

  function clear() {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, rect.width, rect.height)
    setEmpty(true)
    onChange(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs uppercase tracking-wide text-ink-muted">
          {label}
        </span>
        <button
          type="button"
          onClick={clear}
          className="text-xs text-ink-muted hover:text-alarm"
        >
          {t('Арилгах')}
        </button>
      </div>
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        data-testid={`sig-${label}`}
        className="w-full h-28 rounded border border-rule touch-none bg-white cursor-crosshair"
      />
      {empty && (
        <p className="mt-1 text-xs text-ink-muted">
          {t('Дээр нь гарын үсгээ зурна уу')}
        </p>
      )}
    </div>
  )
}
