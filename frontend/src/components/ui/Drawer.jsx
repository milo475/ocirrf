import { useEffect, useState } from 'react'

/** Баруун талаас гулсаж гарах ерөнхий drawer */
export default function Drawer({ open, onClose, title, children, width = 420 }) {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (!open) {
      setShown(false)
      return
    }
    const id = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Хаах"
        onClick={onClose}
        className={`absolute inset-0 w-full bg-bg transition-opacity duration-300 motion-reduce:transition-none ${
          shown ? 'opacity-60' : 'opacity-0'
        }`}
      />
      <aside
        style={{ width }}
        className={`absolute right-0 top-0 h-full max-w-[90vw] bg-surface border-l border-rule overflow-y-auto transition-transform duration-300 motion-reduce:transition-none ${
          shown ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-rule">
          <h2 className="font-serif text-lg font-medium">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Хаах"
            className="text-ink-muted hover:text-ink text-xl leading-none"
          >
            ×
          </button>
        </div>
        {/* Утсан дээр доод tab bar-ын өндөрийг нөхнө — эс тэгвэл
            төгсгөлийн товчнууд түүний ард дарагдана */}
        <div className="p-4 sm:p-6 pb-24 md:pb-6">{children}</div>
      </aside>
    </div>
  )
}
