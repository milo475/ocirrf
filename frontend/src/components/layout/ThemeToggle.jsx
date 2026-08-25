import { useEffect, useState } from 'react'

/** data-theme аттрибутыг <html> дээр сэлгэнэ. Сонголт localStorage-д хадгалагдана. */
export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('theme') ?? 'dark'
    } catch {
      return 'dark'
    }
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('theme', theme)
    } catch {
      /* хадгалж чадаагүй нь асуудалгүй */
    }
  }, [theme])

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="border border-rule rounded px-2.5 py-1 text-sm text-ink-muted hover:text-ink"
      title="Тема солих"
    >
      {theme === 'dark' ? '◐ Харанхуй' : '◑ Цайвар'}
    </button>
  )
}
