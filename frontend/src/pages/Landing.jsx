import { useEffect, useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { Link, Navigate } from 'react-router'
import { homeFor } from '../components/auth/RoleRoute'
import ThemeToggle from '../components/layout/ThemeToggle'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import { api } from '../lib/api'
import { APP_FEATURES } from '../lib/appFeatures'
import { appIcon } from '../lib/appIcon'

/**
 * ПЛАТФОРМЫН НИЙТИЙН НҮҮР — «системийн индекс».
 *
 * Уриа лоозонтой hero биш: дээд navbar (нэвтрэх/бүртгүүлэх баруун буланд),
 * дараа нь платформын бодит агуулга — БЭЛЭН системүүд онцлох хавтангаар
 * (боломжуудын жагсаалттай), удахгүй нэмэгдэх системүүд дугаартай
 * индекс жагсаалтаар. Serif гарчиг + mono шошго = платформын хэв маяг.
 * Нэвтэрсэн хэрэглэгч энд ирвэл хаб руугаа шилжинэ.
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

  if (user) return <Navigate to={homeFor(user.role)} replace />

  const ready = (apps ?? []).filter((a) => a.status === 'ACTIVE')
  const soon = (apps ?? []).filter((a) => a.status !== 'ACTIVE')

  return (
    <main className="relative isolate min-h-screen text-ink flex flex-col">
      {/*
       * ДЭВСГЭР ЗУРАГ — frontend/public/landing-bg.jpg (build-д dist/ руу хуулагдана).
       * Файл байхгүй бол background-image чимээгүй алгасаж зөвхөн bg-bg өнгө
       * харагдана. Дээр нь темийн өнгийн градиент (дээд талд зураг илүү
       * харагдаж, доошоо контент уншигдахуйц болтол бүдгэрнэ) — цайвар/харанхуй
       * хоёуланд ажиллана. Зургийг солихдоо файлаа л солино, код хөндөхгүй.
       */}
      <div aria-hidden="true" className="fixed inset-0 -z-10 bg-bg">
        <div
          className="absolute inset-0 bg-center bg-cover"
          style={{ backgroundImage: "url('/landing-bg.jpg')" }}
        />
        {/* Харанхуй темд зураг тод (overlay сул), цайварт бараан зураг дээр
            бараан текст уншигдахуйц болтол хүчтэй overlay */}
        <div className="absolute inset-0 bg-linear-to-b from-bg/20 via-bg/65 to-bg light:from-bg/75 light:via-bg/90 light:to-bg" />
      </div>

      {/* ── Navbar: нэвтрэлт баруун дээд буланд ── */}
      <header className="sticky top-0 z-30 bg-bg/85 backdrop-blur border-b border-rule">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link to="/" className="font-serif text-2xl font-medium tracking-tight">
            ocirrf
          </Link>
          <span className="hidden md:inline font-mono text-[11px] uppercase tracking-widest text-ink-muted">
            {t('Дотоод системүүдийн платформ')}
          </span>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Link
              to="/login"
              className="rounded px-3 py-1.5 text-sm text-ink-muted hover:text-ink hover:bg-surface transition-colors"
            >
              {t('Нэвтрэх')}
            </Link>
            <Link
              to="/signup"
              className="bg-ink text-bg rounded px-4 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              {t('Бүртгүүлэх')}
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-6xl mx-auto w-full px-6 py-12 md:py-16">
        {/* ── Индексийн толгой ── */}
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-rule pb-6">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-ink-muted">
              {t('Платформ')}
            </p>
            <h1 className="mt-2 font-serif text-4xl md:text-5xl font-medium">
              {t('Системүүд')}
            </h1>
          </div>
          {apps && (
            <dl className="grid grid-cols-3 gap-6 font-mono text-xs">
              <Stat label={t('Нийт')} value={apps.length} />
              <Stat label={t('Бэлэн')} value={ready.length} tone="text-safe" />
              <Stat label={t('Удахгүй')} value={soon.length} />
            </dl>
          )}
        </div>

        {apps === null ? (
          <p className="mt-10 font-mono text-sm text-ink-muted">
            {t('ачаалж байна…')}
          </p>
        ) : (
          <>
            {/* ── Бэлэн системүүд — онцлох хавтан ── */}
            {ready.length > 0 && (
              <section className="mt-10">
                <SectionLabel index="I" text={t('Бэлэн')} />
                <div
                  className={`mt-4 grid gap-4 ${
                    ready.length > 1 ? 'lg:grid-cols-2' : ''
                  }`}
                >
                  {ready.map((app, i) => (
                    <FeaturedSystem key={app.key} app={app} index={i + 1} t={t} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Удахгүй — дугаартай индекс ── */}
            {soon.length > 0 && (
              <section className="mt-14">
                <SectionLabel index="II" text={t('Удахгүй нэмэгдэх')} />
                <ol className="mt-4 grid md:grid-cols-2 md:gap-x-10 border-t border-rule">
                  {soon.map((app, i) => (
                    <IndexRow
                      key={app.key}
                      app={app}
                      index={ready.length + i + 1}
                      t={t}
                    />
                  ))}
                </ol>
              </section>
            )}

            {apps.length === 0 && (
              <p className="mt-10 text-sm text-ink-muted">
                {t('Каталогт систем алга — платформын админд хандана уу.')}
              </p>
            )}
          </>
        )}
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-rule">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-muted">
          <span className="font-serif text-sm text-ink">ocirrf</span>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hover:text-ink">
              {t('Нэвтрэх')}
            </Link>
            <Link to="/signup" className="hover:text-ink">
              {t('Бүртгүүлэх')}
            </Link>
            <span>© {new Date().getFullYear()} ocirrf</span>
          </div>
        </div>
      </footer>
    </main>
  )
}

function Stat({ label, value, tone = 'text-ink' }) {
  return (
    <div>
      <dt className="uppercase tracking-widest text-[10px] text-ink-muted">
        {label}
      </dt>
      <dd className={`mt-1 font-serif text-2xl ${tone}`}>{value}</dd>
    </div>
  )
}

function SectionLabel({ index, text }) {
  return (
    <p className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-widest text-ink-muted">
      <span className="text-ink">{index}</span>
      {text}
    </p>
  )
}

/** Бэлэн систем: том icon, боломжуудын жагсаалт, танилцах/нэвтрэх */
function FeaturedSystem({ app, index, t }) {
  const Icon = appIcon(app.icon)
  const features = (APP_FEATURES[app.key] ?? []).slice(0, 4)
  return (
    <article
      data-testid="catalog-card"
      className="relative border border-rule rounded-lg bg-surface overflow-hidden"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: app.color }}
      />
      <div className="p-6 md:p-8 md:flex md:gap-8">
        <div className="md:w-64 shrink-0">
          <div className="flex items-start justify-between">
            <span
              className="w-14 h-14 rounded-lg flex items-center justify-center text-white"
              style={{ backgroundColor: app.color }}
            >
              <Icon size={28} strokeWidth={1.75} />
            </span>
            <span className="font-mono text-xs text-ink-muted">
              {String(index).padStart(2, '0')}
            </span>
          </div>
          <h2 className="mt-4 font-serif text-3xl font-medium">{app.nameMn}</h2>
          <p className="font-mono text-xs text-ink-muted">{app.nameEn}</p>
          <p className="mt-3 text-sm text-ink-muted leading-relaxed">
            {app.descriptionMn}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to={`/apps/${app.key}`}
              className="inline-flex items-center gap-1.5 bg-ink text-bg rounded px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              {t('Дэлгэрэнгүй')} <ArrowRight size={15} />
            </Link>
            <Link
              to="/login"
              className="text-sm text-ink-muted underline underline-offset-4 hover:text-ink"
            >
              {t('Нэвтрэх')}
            </Link>
          </div>
        </div>
        {features.length > 0 && (
          <ul className="mt-6 md:mt-0 md:flex-1 md:border-l md:border-rule md:pl-8 grid sm:grid-cols-2 gap-x-6 gap-y-3 content-start">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm leading-snug">
                <Check
                  size={15}
                  className="mt-0.5 shrink-0"
                  style={{ color: app.color }}
                />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  )
}

/** Удахгүй нэмэгдэх систем: индексийн мөр (дугаар · icon · нэр · тайлбар) */
function IndexRow({ app, index, t }) {
  const Icon = appIcon(app.icon)
  return (
    <li className="border-b border-rule">
      <Link
        to={`/apps/${app.key}`}
        data-testid="catalog-card"
        className="group grid grid-cols-[2.5rem_2.5rem_1fr_auto] items-center gap-4 py-4 hover:bg-surface/60 transition-colors -mx-3 px-3 rounded"
      >
        <span className="font-mono text-xs text-ink-muted">
          {String(index).padStart(2, '0')}
        </span>
        <span
          className="w-10 h-10 rounded-md flex items-center justify-center text-white opacity-80 group-hover:opacity-100 transition-opacity"
          style={{ backgroundColor: app.color }}
        >
          <Icon size={18} strokeWidth={1.75} />
        </span>
        <span className="min-w-0">
          <span className="block font-medium leading-snug">{app.nameMn}</span>
          <span className="block text-sm text-ink-muted truncate">
            {app.descriptionMn}
          </span>
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink-muted border border-rule rounded px-1.5 py-0.5 whitespace-nowrap">
          {t('Удахгүй')}
        </span>
      </Link>
    </li>
  )
}
