import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, LogOut } from 'lucide-react'
import ThemeToggle from '../components/layout/ThemeToggle'
import { manifestFor } from '../apps'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import { api } from '../lib/api'
import { appIcon } from '../lib/appIcon'
import { isStudexaStudent } from '../lib/studentUser'

/**
 * OCIRRF ХАБ — нэвтэрсний дараах нүүр хуудас.
 *
 * ocirrf нь олон системийн платформ: каталогийн 10 систем тус бүр өөрийн
 * module (backend NestJS module + frontend манифест/lazy chunk). Энэ хуудас
 * тэдгээрийг card-аар харуулж, байгууллагын төлөвөөр ялгана:
 *   enabled   — байгууллагад идэвхтэй → card дарахад системийн нүүр
 *               (манифестийн basePath; манифестгүй бол /apps/:key)
 *   available — каталогт ACTIVE, гэхдээ байгууллага идэвхжүүлээгүй →
 *               platform.manage_apps эрхтэй хүн энд шууд идэвхжүүлнэ
 *   soon      — COMING_SOON → танилцуулга хуудас, «Тун удахгүй»
 * «Урсгал» (ursgal) нь эдгээрийн зөвхөн нэг нь.
 */
export default function Launcher() {
  const { user, hasPerm, logout } = useAuth()
  const { t } = useLang()
  const navigate = useNavigate()
  const [catalog, setCatalog] = useState(null)
  const [myApps, setMyApps] = useState(null)
  const [enabling, setEnabling] = useState(null)
  const [error, setError] = useState(null)

  const load = () => {
    api('/platform/apps')
      .then(setCatalog)
      .catch(() => setCatalog([]))
    api('/platform/my-apps')
      .then(setMyApps)
      .catch(() => setMyApps([]))
  }
  useEffect(load, [])

  const enabledKeys = new Set((myApps ?? []).map((a) => a.key))
  const canManage = hasPerm('platform.manage_apps')
  const loading = catalog === null || myApps === null
  // Studexa-гийн сурагчид цөм «Урсгал» (агуулах/захиалга) хамаагүй — нуух
  const student = isStudexaStudent(user)
  const systems = (catalog ?? [])
    .filter((app) => !(student && app.key === 'ursgal'))
    .map((app) => ({
      ...app,
      state: enabledKeys.has(app.key)
        ? 'enabled'
        : app.status === 'ACTIVE'
          ? 'available'
          : 'soon',
    }))
  const enabledCount = systems.filter((s) => s.state === 'enabled').length

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
          ocirrf
        </span>
        {user?.organizationName && (
          <span className="hidden sm:inline text-sm text-ink-muted truncate">
            · {user.organizationName}
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          {user?.isSuperAdmin && (
            <Link
              to="/platform-admin"
              className="text-sm text-ink-muted hover:text-ink underline underline-offset-2"
            >
              {t('Платформ удирдлага')}
            </Link>
          )}
          <ThemeToggle />
          <span className="text-sm text-ink-muted hidden md:inline">
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

      <div className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="font-serif text-3xl font-medium">
          {t('Сайн байна уу')}, {user?.name}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {t('Ажиллах системээ сонгоно уу')}
          {!loading && (
            <>
              {' · '}
              {t('{n} систем, {m} идэвхтэй', {
                n: systems.length,
                m: enabledCount,
              })}
            </>
          )}
        </p>

        {error && (
          <p className="mt-4 text-sm text-alarm border border-alarm rounded px-3 py-2">
            {error}
          </p>
        )}

        {loading ? (
          <p className="mt-8 font-mono text-sm text-ink-muted">
            {t('ачаалж байна…')}
          </p>
        ) : (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {systems.map((app, i) => (
              <SystemCard
                key={app.key}
                app={app}
                index={i + 1}
                t={t}
                canManage={canManage}
                enabling={enabling === app.key}
                onEnable={() => enable(app.key)}
              />
            ))}
            {systems.length === 0 && (
              <p className="text-sm text-ink-muted col-span-full">
                {t('Каталогт систем алга — платформын админд хандана уу.')}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

/**
 * Нэг системийн card. enabled → Link (системийн нүүр), soon → Link
 * (танилцуулга /apps/:key), available → идэвхжүүлэх товчтой div.
 */
function SystemCard({ app, index, t, canManage, enabling, onEnable }) {
  const Icon = appIcon(app.icon)
  const enabled = app.state === 'enabled'
  const soon = app.state === 'soon'
  const href = enabled
    ? (manifestFor(app.key)?.basePath ?? `/apps/${app.key}`)
    : `/apps/${app.key}`

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span
          className="w-11 h-11 rounded-md flex items-center justify-center text-white"
          style={{ backgroundColor: app.color }}
        >
          <Icon size={22} strokeWidth={1.75} />
        </span>
        <span className="font-mono text-[11px] text-ink-muted/70">
          {String(index).padStart(2, '0')}
        </span>
      </div>
      <h2 className="mt-3 font-medium leading-snug">{app.nameMn}</h2>
      <p className="font-mono text-[11px] text-ink-muted">{app.nameEn}</p>
      <p className="mt-2 text-sm text-ink-muted leading-snug line-clamp-3">
        {app.descriptionMn}
      </p>
      <div className="mt-auto pt-4 flex items-center justify-between gap-2 text-xs">
        {enabled && (
          <>
            <span className="font-mono uppercase tracking-wide text-safe">
              {t('Идэвхтэй')}
            </span>
            <span className="flex items-center gap-1 text-ink group-hover:translate-x-0.5 transition-transform">
              {t('Нээх')} <ArrowRight size={14} />
            </span>
          </>
        )}
        {soon && (
          <span className="font-mono uppercase tracking-wide border border-rule rounded px-1.5 py-0.5 text-ink-muted">
            {t('Тун удахгүй')}
          </span>
        )}
        {app.state === 'available' &&
          (canManage ? (
            <button
              type="button"
              disabled={enabling}
              onClick={onEnable}
              className="border border-rule rounded px-3 py-1.5 text-sm hover:border-ink-muted disabled:opacity-60"
            >
              {enabling ? t('Идэвхжүүлж байна…') : t('Идэвхжүүлэх')}
            </button>
          ) : (
            <span className="text-ink-muted">{t('Идэвхжүүлэхийг админ хийнэ')}</span>
          ))}
      </div>
    </>
  )

  const base =
    'group flex flex-col h-full border rounded-lg p-5 bg-surface transition-all'
  if (app.state === 'available') {
    return (
      <div
        data-testid="system-card"
        data-state={app.state}
        className={`${base} border-rule`}
      >
        {body}
      </div>
    )
  }
  return (
    <Link
      to={href}
      data-testid="system-card"
      data-state={app.state}
      className={`${base} ${
        enabled
          ? 'border-rule hover:border-ink-muted hover:shadow-lg'
          : 'border-rule/60 opacity-60 hover:opacity-90'
      }`}
    >
      {body}
    </Link>
  )
}
