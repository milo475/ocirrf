import { useEffect, useState } from 'react'

/**
 * Хэсэг доороос дээш зөөлөн гарч ирнэ (DASHBOARD.md Алхам 12).
 * delay-гээр 60мс-ийн зөрүүтэй дараалуулна.
 * prefers-reduced-motion үед шилжилтгүй шууд харагдана.
 */
export default function Rise({ delay = 0, children }) {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-500 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0 ${
        shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      {children}
    </div>
  )
}
