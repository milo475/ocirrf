import { createContext, useCallback, useContext, useRef, useState } from 'react'

const ToastContext = createContext(null)

let nextId = 1

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
  }, [])

  /** show('Хадгалагдлаа') эсвэл show('Алдаа', { type: 'error' }) */
  const show = useCallback(
    (message, { type = 'success', duration = 4000 } = {}) => {
      const id = nextId++
      setToasts((list) => [...list, { id, message, type }])
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      )
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] space-y-2 w-72">
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            className={`w-full text-left bg-surface border rounded px-4 py-3 text-sm shadow-lg transition-opacity ${
              t.type === 'error' ? 'border-alarm text-alarm' : 'border-rule text-ink'
            }`}
          >
            {t.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast-ыг ToastProvider дотор л хэрэглэнэ')
  return ctx
}
