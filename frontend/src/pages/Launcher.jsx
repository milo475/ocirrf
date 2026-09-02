import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { LogOut } from 'lucide-react'
import { manifestFor } from '../apps'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import { api } from '../lib/api'
import { appIcon } from '../lib/appIcon'

/**
 * APP LAUNCHER — нэвтэрсний дараах анхны хуудас (платформ бүрхүүл).
 * Байгууллагын идэвхтэй app-ууд + идэвхжүүлж болох ACTIVE app-ууд.
 */
export default function Launcher() {
  const { user, hasPerm, logout } = useAuth()
  const { t } = useLang()
  const navigate = useNavigate()
  const [myApps, setMyApps] = useState(null)
  const [catalog, setCatalog] = useState([])
  const [enabling, setEnabling] = useState(null)
  const [error, setError] = useState(null)

  const load = () => {
    api('/platform/my-apps')
      .then(setMyApps)
      .catch(() => setMyApps([]))
    api('/platform/apps')
      .then(setCatalog)
      .catch(() => setCatalog([]))
  }
  useEffect(load, [])

  const enabledKeys = new Set((myApps ?? []).map((a) => a.key))
  const available = catalog.filter(
    (a) => a.status === 'ACTIVE' && !enabledKeys.has(a.key),
  )
  const canManage = hasPerm('platform.manage_apps')

  async function enable(key) {
    setError(null)
    setEnabling(key)
    try {
      await api(`/platform/my-apps/${key}/enable`, { method: 'POST' })
      load()
    } catch (e) {
      setError(e.message ?? 'Алдаа гарлаа')
    } finally {
      setEnabling(null)
    }
  }

  return (
    <main className="min-h-screen bg-bg text-ink">
      {/* ── Платформын толгой ── */}
      <header className="h-12 border-b border-rule flex items-center gap-3 px-4 md:px-6">
        <span className="font-serif text-xl font-medium tracking-tight">
          {user?.organizationName ?? 'ocirrf'}
        </span>
        <div className="ml-auto flex items-center gap-3">
          {user?.isSuperAdmin && (
            <Link
              to="/platform-admin"
              className="text-sm text-ink-muted hover:text-ink underline underline-offset-2"
            >
              {t('Платформ удирдлага')}
            </Link>
          )}
          <span className="text-sm text-ink-muted hidden sm:inline">
            {user?.name}
          </span>
          <button
            type="button"
            onClick={() => {
              logout()
              navigate('/login')
            }}
            className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
          >
            <LogOut size={15} /> {t('Гарах')}
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="font-serif text-2xl font-medium">
          {t('Сайн байна уу')}, {user?.name}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t('Ажиллах системээ сонгоно уу')}
        </p>

        {/* ── Идэвхтэй app-ууд ── */}
        {myApps === null ? (
          <p className="mt-8 font-mono text-sm text-ink-muted">
            {t('ачаалж байна…')}
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {myApps.map((app) => {
              const Icon = appIcon(app.icon)
              const manifest = manifestFor(app.key)
              return (
                <Link
                  key={app.key}
                  to={manifest?.basePath ?? '/launcher'}
                  className="block border border-rule rounded-lg p-5 bg-surface hover:border-ink-muted hover:shadow-lg transition-all"
                >
                  <span
                    className="w-11 h-11 rounded-md flex items-center justify-center text-white"
                    style={{ backgroundColor: app.color }}
                  >
                    <Icon size={22} strokeWidth={1.75} />
                  </span>
                  <h2 className="mt-3 font-medium">{app.nameMn}</h2>
                  <p className="mt-1 text-sm text-ink-muted leading-snug">
                    {app.descriptionMn}
                  </p>
                </Link>
              )
            })}
            {myApps.length === 0 && (
              <p className="text-sm text-ink-muted col-span-full">
                {t('Идэвхтэй app алга — админдаа хандана уу.')}
              </p>
            )}
          </div>
        )}

        {/* ── Идэвхжүүлэх боломжтой ── */}
        {available.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xs font-mono uppercase tracking-widest text-ink-muted">
              {t('Идэвхжүүлэх боломжтой')}
            </h2>
            {error && (
              <p className="mt-3 text-sm text-alarm border border-alarm rounded px-3 py-2">
                {error}
              </p>
            )}
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {available.map((app) => {
                const Icon = appIcon(app.icon)
                return (
                  <div
                    key={app.key}
                    className="border border-rule rounded-lg p-5 bg-surface opacity-75"
                  >
                    <span
                      className="w-11 h-11 rounded-md flex items-center justify-center text-white"
                      style={{ backgroundColor: app.color }}
                    >
                      <Icon size={22} strokeWidth={1.75} />
                    </span>
                    <h3 className="mt-3 font-medium">{app.nameMn}</h3>
                    <p className="mt-1 text-sm text-ink-muted leading-snug">
                      {app.descriptionMn}
                    </p>
                    {canManage ? (
                      <button
                        type="button"
                        disabled={enabling === app.key}
                        onClick={() => enable(app.key)}
                        className="mt-3 text-sm border border-rule rounded px-3 py-1.5 hover:border-ink-muted disabled:opacity-60"
                      >
                        {enabling === app.key
                          ? t('Идэвхжүүлж байна…')
                          : t('Идэвхжүүлэх')}
                      </button>
                    ) : (
                      <p className="mt-3 text-xs text-ink-muted">
                        {t('Идэвхжүүлэхийг админ хийнэ')}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
