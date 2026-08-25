import { createContext, useContext, useEffect, useState } from 'react'

/** Тема нэг эх сурвалжтай — header-ийн солигч, Settings хуудас хоёул үүнийг хэрэглэнэ */
const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
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
      /* үл тоомсорлоно */
    }
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme-ийг ThemeProvider дотор л хэрэглэнэ')
  return ctx
}
