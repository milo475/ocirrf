import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { homeFor } from '../components/auth/RoleRoute'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import { api } from '../lib/api'
import { appIcon } from '../lib/appIcon'

/**
 * ПЛАТФОРМЫН НИЙТИЙН НҮҮР (Odoo маягийн card grid).
 *
 * Нэвтрээгүй хүн платформын танилцуулга + app каталогийг харна.
 * Нэвтэрсэн хэрэглэгч энд ирвэл ажлын орчин руугаа шилжинэ.
 */
export default function Landing() {
  const { user, loading } = useAuth()
  const { t } = useLang()
  const [apps, setApps] = useState(null)

  useEffect(() => {
    let alive = true
    api('/platform/apps')
      .then((data) => alive && setApps(data))
      .catch(() => alive && setApps([]))
    return () => {
      alive = false
    }
  }, [])

  if (loading) {
    return (
      <main className="min-h-screen bg-bg text-ink-muted flex items-center justify-center font-mono text-sm">
        {t('ачаалж байна…')}
      </main>
    )
  }

  // Нэвтэрсэн хэрэглэгч landing биш шууд ажлын орчиндоо
  if (user) return <Navigate to={homeFor(user.role)} replace />

  return (
    <main className="min-h-screen bg-bg text-ink flex flex-col">
      {/* ── Hero ── */}
      <header className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-center bg-cover opacity-60"
          style={{ backgroundImage: "url('/login-bg.png')" }}
        />
        <div aria-hidden="true" className="absolute inset-0 bg-black/40" />
        <div className="relative max-w-5xl mx-auto px-6 py-20 md:py-28 text-center">
          <h1 className="font-serif text-5xl md:text-6xl font-medium text-white">
            ocirrf
          </h1>
          <p className="mt-4 text-lg md:text-xl text-white/80 max-w-2xl mx-auto">
            {t('Танай бизнесийн бүх дотоод систем — нэг дор')}
          </p>
          <p className="mt-2 text-sm text-white/60 max-w-xl mx-auto">
            {t(
              'Агуулахаас санхүү хүртэл — байгууллагаа бүртгээд хэрэгтэй системээ идэвхжүүлээрэй.',
            )}
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              to="/signup"
              className="bg-white text-black rounded px-6 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              {t('Бүртгүүлэх')}
            </Link>
            <Link
              to="/login"
              className="border border-white/40 text-white rounded px-6 py-2.5 text-sm font-medium hover:bg-white/10 transition-colors"
            >
              {t('Нэвтрэх')}
            </Link>
          </div>
        </div>
      </header>

      {/* ── App каталог ── */}
      <section className="flex-1 max-w-5xl mx-auto w-full px-6 py-12 md:py-16">
        <h2 className="font-serif text-2xl font-medium">{t('Системүүд')}</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {t('Байгууллага бүр өөрт хэрэгтэй app-уудаа сонгож идэвхжүүлнэ')}
        </p>

        {apps === null ? (
          <p className="mt-8 font-mono text-sm text-ink-muted">
            {t('ачаалж байна…')}
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {apps.map((app) => {
              const Icon = appIcon(app.icon)
              const active = app.status === 'ACTIVE'
              const card = (
                <div
                  className={`relative h-full border border-rule rounded-lg p-5 bg-surface transition-all ${
                    active
                      ? 'hover:border-ink-muted hover:shadow-lg cursor-pointer'
                      : 'opacity-55'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="shrink-0 w-10 h-10 rounded-md flex items-center justify-center text-white"
                      style={{ backgroundColor: app.color }}
                    >
                      <Icon size={20} strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-medium flex items-center gap-2">
                        {app.nameMn}
                        {!active && (
                          <span className="text-[10px] font-mono uppercase tracking-wide border border-rule rounded px-1.5 py-0.5 text-ink-muted">
                            {t('Тун удахгүй')}
                          </span>
                        )}
                      </h3>
                      <p className="mt-1 text-sm text-ink-muted leading-snug">
                        {app.descriptionMn}
                      </p>
                    </div>
                  </div>
                </div>
              )
              return active ? (
                <Link key={app.key} to={`/apps/${app.key}`} className="block">
                  {card}
                </Link>
              ) : (
                <div key={app.key} aria-disabled="true">
                  {card}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-rule">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between text-xs text-ink-muted">
          <span className="font-serif text-sm text-ink">ocirrf</span>
          <span>© {new Date().getFullYear()} ocirrf</span>
        </div>
      </footer>
    </main>
  )
}
