import { useEffect, useState } from 'react'
import { useLang } from '../context/LanguageContext'
import { api } from '../lib/api'
import { appIcon } from '../lib/appIcon'

/**
 * БАЙГУУЛЛАГЫН APP УДИРДЛАГА (platform.manage_apps).
 * ACTIVE app бүрийг идэвхжүүлэх/унтраах; цөм "Урсгал" хамгаалагдсан.
 */
export default function AppsSettings() {
  const { t } = useLang()
  const [catalog, setCatalog] = useState(null)
  const [enabled, setEnabled] = useState(new Set())
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  const load = () => {
    setError(null)
    Promise.all([api('/platform/apps'), api('/platform/my-apps')])
      .then(([apps, mine]) => {
        setCatalog(apps.filter((a) => a.status === 'ACTIVE'))
        setEnabled(new Set(mine.map((a) => a.key)))
      })
      .catch((e) => setError(e.message ?? 'Алдаа гарлаа'))
  }
  useEffect(load, [])

  async function toggle(app) {
    setError(null)
    setBusy(app.key)
    try {
      if (enabled.has(app.key)) {
        await api(`/platform/my-apps/${app.key}`, { method: 'DELETE' })
      } else {
        await api(`/platform/my-apps/${app.key}/enable`, { method: 'POST' })
      }
      load()
    } catch (e) {
      setError(e.message ?? 'Алдаа гарлаа')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-2xl font-medium">{t('Апп-ууд')}</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {t('Байгууллагадаа ашиглах системүүдээ идэвхжүүлнэ')}
      </p>

      {error && (
        <p className="mt-4 text-sm text-alarm border border-alarm rounded px-3 py-2">
          {error}
        </p>
      )}

      {catalog === null ? (
        <p className="mt-6 font-mono text-sm text-ink-muted">
          {t('ачаалж байна…')}
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {catalog.map((app) => {
            const Icon = appIcon(app.icon)
            const isOn = enabled.has(app.key)
            const isCore = app.key === 'ursgal'
            return (
              <li
                key={app.key}
                className="border border-rule rounded-lg p-4 bg-surface flex items-center gap-4"
              >
                <span
                  className="shrink-0 w-10 h-10 rounded-md flex items-center justify-center text-white"
                  style={{ backgroundColor: app.color }}
                >
                  <Icon size={20} strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-medium">{app.nameMn}</h2>
                  <p className="text-sm text-ink-muted truncate">
                    {app.descriptionMn}
                  </p>
                  {isCore && (
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {t('Цөм систем — унтраах боломжгүй')}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isOn}
                  disabled={busy === app.key || (isOn && isCore)}
                  onClick={() => toggle(app)}
                  className={`shrink-0 relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${
                    isOn ? 'bg-accent' : 'bg-rule'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
                      isOn ? 'left-[22px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
