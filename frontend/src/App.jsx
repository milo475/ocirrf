import { useEffect, useState } from 'react'

// Алхам 1 — фонт, токен, тема солилтыг батлах түр хуудас.
// Алхам 2 дээр жинхэнэ header-ээр солигдоно.
function App() {
  const [theme, setTheme] = useState('dark')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return (
    <main className="max-w-6xl mx-auto px-6 py-16 space-y-8">
      <button
        type="button"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="border border-rule rounded px-3 py-1.5 text-sm text-ink-muted hover:text-ink"
      >
        Тема: {theme === 'dark' ? 'харанхуй' : 'цайвар'}
      </button>

      <h1 className="font-serif text-5xl font-medium">
        Нөөцийн эрүүл мэнд — Newsreader serif
      </h1>

      <p className="font-mono text-ink-muted">
        75 бараа / ₮48.2сая — IBM Plex Mono 0123456789
      </p>

      <p className="font-sans max-w-prose">
        Энэ бол Work Sans үндсэн текст. Аль бараа дуусах гэж байна, аль нь
        хэдэн төгрөгийн эрсдэлтэй вэ гэдгийг энэ самбар харуулна.
      </p>

      <p>
        <span className="text-alarm">alarm — эрсдэл</span>{' · '}
        <span className="text-safe">safe — сайжирсан</span>{' · '}
        <span className="bg-surface border border-rule rounded px-2 py-1">surface</span>
      </p>
    </main>
  )
}

export default App
