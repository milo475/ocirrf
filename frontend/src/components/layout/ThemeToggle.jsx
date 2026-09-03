import { useLang } from '../../context/LanguageContext'
import { useTheme } from '../../context/ThemeContext'

/** Темийг ThemeContext-ээр удирдана — Settings хуудастай нэг эх сурвалж */
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const { t } = useLang()

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="border border-rule rounded px-2.5 py-1 text-sm text-ink-muted hover:text-ink
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      title={t('Тема солих')}
    >
      {theme === 'dark' ? `◐ ${t('Харанхуй')}` : `◑ ${t('Цайвар')}`}
    </button>
  )
}
