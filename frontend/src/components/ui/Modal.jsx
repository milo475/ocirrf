import { useEffect } from 'react'

/** Голдоо гарч ирэх modal. Esc болон backdrop дарахад хаагдана */
export default function Modal({ open, onClose, title, children, footer }) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Хаах"
        onClick={onClose}
        className="absolute inset-0 w-full bg-bg opacity-60"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md bg-surface border border-rule rounded-lg shadow-xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-rule">
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
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="px-5 py-4 border-t border-rule flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
