import { useLang } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'

function OptionGroup({ label, options, value, onChange, note }) {
  return (
    <section className="mt-10 first:mt-0">
      <p className="text-xs uppercase tracking-wide text-ink-muted mb-3">
        {label}
      </p>
      <div className="inline-flex border border-rule rounded overflow-hidden">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`px-4 py-2 text-sm transition-colors ${
              value === o.value
                ? 'bg-surface text-ink'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {note && <p className="mt-3 text-sm text-ink-muted max-w-md">{note}</p>}
    </section>
  )
}

export default function Settings() {
  const { lang, setLang, t } = useLang()
  const { theme, setTheme } = useTheme()

  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-4xl font-medium">{t('Тохиргоо')}</h1>

      <div className="mt-10 border-t border-rule pt-8">
        <OptionGroup
          label={t('Хэл')}
          value={lang}
          onChange={setLang}
          options={[
            { value: 'mn', label: 'Монгол' },
            { value: 'en', label: 'English' },
          ]}
          note={t(
            'Интерфэйсийн хэлийг сонгоно. Серверийн алдааны мессежүүд одоогоор зөвхөн монголоор ирдэг.',
          )}
        />

        <OptionGroup
          label={t('Тема')}
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'dark', label: t('Харанхуй') },
            { value: 'light', label: t('Цайвар') },
          ]}
        />
      </div>
    </div>
  )
}
