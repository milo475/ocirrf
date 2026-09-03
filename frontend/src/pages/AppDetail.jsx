import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Check } from 'lucide-react'
import { useLang } from '../context/LanguageContext'
import { api } from '../lib/api'
import { appIcon } from '../lib/appIcon'
import { APP_FEATURES } from '../lib/appFeatures'
import { appName, appNameAlt } from '../lib/appName'

export default function AppDetail() {
  const { key } = useParams()
  const { t, lang } = useLang()
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

  if (apps === null) {
    return (
      <main className="min-h-screen bg-bg text-ink-muted flex items-center justify-center font-mono text-sm">
        {t('ачаалж байна…')}
      </main>
    )
  }

  const app = apps.find((a) => a.key === key)

  return (
    <main className="min-h-screen bg-bg text-ink">
      <div className="max-w-3xl mx-auto px-6 py-10 md:py-16">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft size={16} /> {t('Нүүр хуудас')}
        </Link>

        {!app ? (
          <div className="mt-10 border border-rule rounded-lg p-8 text-center bg-surface">
            <h1 className="font-serif text-2xl">{t('App олдсонгүй')}</h1>
            <p className="mt-2 text-sm text-ink-muted">
              {t('Ийм түлхүүртэй систем каталогт байхгүй байна.')}
            </p>
          </div>
        ) : app.status !== 'ACTIVE' ? (
          <ComingSoon app={app} t={t} lang={lang} />
        ) : (
          <ActiveApp app={app} t={t} lang={lang} />
        )}
      </div>
    </main>
  )
}

function AppHeader({ app, lang }) {
  const Icon = appIcon(app.icon)
  return (
    <div className="flex items-center gap-4">
      <span
        className="shrink-0 w-14 h-14 rounded-lg flex items-center justify-center text-white"
        style={{ backgroundColor: app.color }}
      >
        <Icon size={28} strokeWidth={1.75} />
      </span>
      <div>
        <h1 className="font-serif text-3xl font-medium">{appName(app, lang)}</h1>
        <p className="text-sm text-ink-muted">{appNameAlt(app, lang)}</p>
      </div>
    </div>
  )
}

function ComingSoon({ app, t, lang }) {
  return (
    <div className="mt-10">
      <AppHeader app={app} lang={lang} />
      <div className="mt-8 border border-rule rounded-lg p-8 text-center bg-surface">
        <span className="font-mono text-xs uppercase tracking-widest border border-rule rounded px-2 py-1 text-ink-muted">
          {t('Тун удахгүй')}
        </span>
        <p className="mt-4 text-sm text-ink-muted max-w-md mx-auto">
          {t(app.descriptionMn)}
        </p>
        <p className="mt-2 text-sm text-ink-muted">
          {t('Энэ систем удахгүй нээгдэнэ — бэлэн болмогц каталогт идэвхжинэ.')}
        </p>
      </div>
    </div>
  )
}

function ActiveApp({ app, t, lang }) {
  const features = APP_FEATURES[app.key]
  return (
    <div className="mt-10">
      <AppHeader app={app} lang={lang} />
      <p className="mt-6 text-ink-muted">{t(app.descriptionMn)}</p>

      {features && (
        <ul className="mt-6 space-y-2.5">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm">
              <Check
                size={16}
                className="mt-0.5 shrink-0"
                style={{ color: app.color }}
              />
              <span>{t(f)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-10 flex items-center gap-3">
        <Link
          to="/signup"
          className="bg-ink text-bg rounded px-6 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {t('Бүртгүүлээд эхлэх')}
        </Link>
        <Link
          to="/login"
          className="border border-rule rounded px-6 py-2.5 text-sm font-medium hover:border-ink-muted transition-colors"
        >
          {t('Нэвтрэх')}
        </Link>
      </div>
    </div>
  )
}
