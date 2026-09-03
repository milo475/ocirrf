import { useEffect, useState } from 'react'
import {
  ArrowRight,
  Check,
  KeyRound,
  Languages,
  MapPin,
  ShieldCheck,
} from 'lucide-react'
import { Link, Navigate } from 'react-router'
import { homeFor } from '../components/auth/RoleRoute'
import SettingsMenu from '../components/layout/SettingsMenu'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import { useReveal } from '../hooks/useReveal'
import { api } from '../lib/api'
import { APP_FEATURES } from '../lib/appFeatures'
import { appIcon } from '../lib/appIcon'
import { appName, appNameAlt } from '../lib/appName'

/**
 * ПЛАТФОРМЫН НИЙТИЙН НҮҮР (/) — marketing + системийн индекс.
 *
 * ХЭВ МАЯГ: бараан editorial. Serif гарчиг, mono шошго, дугаарласан
 * (01, 02…) индекс, онцолсон Урсгал хавтан. Эдгээр нь ЗОРИУДААР
 * хадгалагдсан — өнгөлгөө, шатлал, зай л чангатсан.
 *
 * ДЭВСГЭР: зураг БАЙХГҮЙ. Лаптопын эх хавтангийн зураг (public/landing-bg.jpg)
 * хасагдсан — утгын холбоогүй байсан ба зургийн дээд хэсэгт overlay сул
 * байснаас текстийн contrast WCAG-аас уначихаж байв. Орлуулга нь index.css-ийн
 * `.landing-glow` — ЦЭВЭР CSS radial-gradient, брэндийн бордо өнгөний НЭГ
 * бүдэг толбо хуудасны дээд талд. Dot/line grid хээ нэмээгүй (хоёуланг
 * давхарлахгүй).
 *
 * CONTRAST (WCAG 2.1 AA, шалгагдсан):
 *   ink       15.31:1 (dark) / 15.11:1 (light)
 *   ink-soft   7.26:1 (dark) / 6.55:1 (light) — толбын дээд цэгт ч 5.01:1
 *   brand-text 6.85:1 (dark) / 8.06:1 (light)
 * ⚠ `text-ink-muted` энэ хуудсанд ХЭРЭГЛЭХГҮЙ: хавтгай дэвсгэр дээр 5.32:1
 *   боловч accent толбын дээд цэгт 3.68:1 болж AA-аас унадаг. Хоёрдогч текст
 *   бүхэлдээ `text-ink-soft`.
 *
 * Нэвтэрсэн хэрэглэгч энд ирвэл хаб/ажлын орчин руугаа шилжинэ.
 */

/** Бүх интерактив элементийн keyboard focus (3:1-ээс дээш, хоёр темд) */
const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-text'

/** Үндсэн CTA — брэндийн дүүргэлт (brand-ink текст 5.50:1 / 7.61:1) */
const CTA_PRIMARY = `inline-flex items-center justify-center gap-2 rounded-md bg-brand text-brand-ink font-medium
  hover:brightness-110 active:brightness-95 transition-[filter] motion-reduce:transition-none ${FOCUS}`

/** Хоёрдогч CTA — ghost (хүрээтэй, дүүргэлтгүй) */
const CTA_GHOST = `inline-flex items-center justify-center gap-2 rounded-md border border-rule-strong text-ink font-medium
  hover:bg-surface transition-colors motion-reduce:transition-none ${FOCUS}`

/** Хуудасны контейнер — 360px-ээс 1920px хүртэл нэг өргөнтэй */
const WRAP = 'max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8'

export default function Landing() {
  const { user, loading } = useAuth()
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

  // Хэсгүүдийн скроллын fade-in. apps ачаалагдахад шинэ хэсгүүд DOM-д
  // орж ирдэг тул [apps]-аар дахин скан хийнэ.
  useReveal([apps])

  if (loading) {
    return (
      <main className="min-h-screen bg-bg text-ink-soft flex items-center justify-center font-mono text-sm">
        {t('ачаалж байна…')}
      </main>
    )
  }

  if (user) return <Navigate to={homeFor(user.role)} replace />

  const ready = (apps ?? []).filter((a) => a.status === 'ACTIVE')
  const soon = (apps ?? []).filter((a) => a.status !== 'ACTIVE')

  return (
    <div className="relative isolate min-h-screen flex flex-col text-ink">
      <Backdrop />
      <SiteHeader t={t} />

      <main className="flex-1">
        <Hero t={t} total={apps === null ? null : apps.length} />

        <Systems t={t} lang={lang} apps={apps} ready={ready} soon={soon} />

        <HowItWorks t={t} />
        <Benefits t={t} />
        <ClosingCta t={t} />
      </main>

      <SiteFooter t={t} />
    </div>
  )
}

/* ══ Дэвсгэр ═════════════════════════════════════════════════════════
 * Хоёр давхарга, ХОЁУЛАА текстээс ЗАЙЛСХИЙСЭН:
 *
 * 1. `.landing-glow` — брэндийн бордогийн бүдэг толбо, зүүн-дээд талд
 *    (текстийн тал). Alpha нь contrast-аар хязгаарлагдсан.
 * 2. `.landing-art` — MacBook-ийн задаргааны зураг, ЗӨВХӨН баруун талд,
 *    зүүн тийш уусаж арилдаг mask-тай.
 *
 * ЯАГААД ЗӨВХӨН БАРУУН ТАЛД: зураг дээр бараг цагаан гялбаанууд байдаг
 * (клавиатурын бичээс, металл ирмэг — relative luminance p99.99 = 0.96).
 * Хэмжилтээр opacity 0.20 дээр ч тэдгээрийн дээр `ink-soft` 1.55:1 болж
 * уначихдаг. Тиймээс зургийг текстийн ДООР тавих аргагүй — ямар ч opacity
 * эсвэл scrim хангалттай биш. Оронд нь текст байхгүй ОРОН ЗАЙД тавьж,
 * mask-аар текстийн тал руу уусгав. Ингэснээр зураг харагдаж, contrast
 * бүрэн хөндөгдөхгүй.
 *
 * lg-ээс доош НУУГДАНА: тэр өргөнд hero-гийн текст бүх талбайг эзэлдэг
 * тул зайлсхийх орон зай байхгүй (мөн мобайлын трафик хэмнэнэ).
 */
function Backdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[44rem] overflow-hidden"
    >
      <div className="absolute inset-x-0 top-0 h-[34rem] landing-glow" />
      <div className="landing-art absolute right-0 top-0 hidden h-full w-[46%] lg:block" />
    </div>
  )
}

/* ══ Navbar ══════════════════════════════════════════════════════════ */
function SiteHeader({ t }) {
  return (
    <header className="sticky top-0 z-30 bg-bg/85 backdrop-blur border-b border-rule">
      <div className={`${WRAP} h-14 flex items-center gap-4`}>
        <Link
          to="/"
          className={`font-serif text-2xl font-medium tracking-tight rounded ${FOCUS}`}
        >
          ocirrf
        </Link>
        <span className="hidden md:inline font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
          {t('Дотоод системүүдийн платформ')}
        </span>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {/*
            Хэл + тема нэг gear товчны цаана. Нэвтрээгүй хүнд `/settings`
            хуудас хүрдэггүй тул нүүр хуудсанд англи хэл рүү сэлгэх өөр арга
            байхгүй. Gear нь өмнөх «◐ Харанхуй» шошготой товчноос нарийн тул
            360px дээр «Нэвтрэх» линк ч зэрэгцэн багтана.
          */}
          <SettingsMenu />
          <Link
            to="/login"
            className={`rounded px-3 py-1.5 text-sm text-ink-soft hover:text-ink hover:bg-surface transition-colors motion-reduce:transition-none ${FOCUS}`}
          >
            {t('Нэвтрэх')}
          </Link>
          <Link
            to="/signup"
            className={`${CTA_PRIMARY} px-3 sm:px-4 py-1.5 text-sm`}
          >
            {t('Бүртгүүлэх')}
          </Link>
        </div>
      </div>
    </header>
  )
}

/* ══ Hero ════════════════════════════════════════════════════════════ */
function Hero({ t, total }) {
  return (
    <section className={`${WRAP} pt-14 pb-4 md:pt-24 md:pb-8`}>
      {/*
       * lg-ээс дээш текстийн багана 52%-аар хязгаарлагдана. Энэ нь гоо
       * зүйн бус ХҮРТЭЭМЖИЙН хязгаарлалт: баруун талын дэвсгэр зурагт
       * бараг цагаан гялбаанууд байдаг тул текст тэр бүс рүү орох ёсгүй.
       * lg-ээс доош зураг нуугддаг тул хязгаарлалт ч хэрэггүй.
       */}
      <div className="lg:max-w-[52%]">
      {/* Navbar-т «Дотоод системүүдийн платформ» аль хэдийн байгаа тул
          hero-гийн шошго өөр өнцөг барина (давхардал болохгүй) */}
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-brand-text">
        {t('Монголын бизнест зориулав')}
      </p>

      {/*
       * Шатлалын 1-р түвшин. PT Serif-д 400/700 л ачаалагдсан тул
       * font-medium нь 400-аар зурагдана (кодын бусад хэсэгтэй ижил) —
       * «хүч» нь хэмжээ, нягт leading, шигтгээ tracking-аас гарна.
       */}
      <h1 className="mt-5 font-serif font-medium tracking-tight text-balance text-[2.5rem] leading-[1.06] sm:text-6xl md:text-7xl max-w-4xl">
        {t('Бүх дотоод удирдлага')}{' '}
        <span className="text-brand-text">{t('нэг платформ дээр')}</span>
      </h1>

      <p className="mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-ink-soft text-pretty">
        {t(
          'Агуулах, захиалга, хүргэлт, санхүү, хүний нөөц. Монголын бизнест зориулсан дотоод системүүд нэг бүртгэлээр, нэг дор.',
        )}
      </p>

      <div className="mt-9 flex flex-wrap items-center gap-3">
        <Link to="/signup" className={`${CTA_PRIMARY} px-6 py-3 text-base`}>
          {t('Үнэгүй эхлэх')}
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <Link to="/login" className={`${CTA_GHOST} px-6 py-3 text-base`}>
          {t('Нэвтрэх')}
        </Link>
      </div>

      <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft">
        {t('Карт шаардахгүй')} · {t('Хэдхэн минутад')} · {t('Монгол хэл дээр')}
      </p>

      {/*
       * Статистикийн мөр — хуучин НИЙТ/БЭЛЭН/УДАХГҮЙ хосын хэв маяг эндээ
       * шилжсэн. grid-cols-3 тул тоо ачаалагдахад багана өргөсдөхгүй
       * (layout shift 0); ачаалагдаж байхад «—» орно.
       */}
      {/*
        ЯАГААД grid-cols-3 БИШ: тэнцүү гурав хуваахад багана 1440px дээр
        167px болдог ч англи режимийн «Mongolian» 36px serif-д 172px
        шаарддаг тул үг дундуураа тасарч байв. flex-wrap нь stat бүрийг
        агуулгаараа өргөсгөж, багтахгүй бол ҮГ таслахын оронд дараагийн
        мөрөнд буулгана — хэлнээс хамаарахгүй болов.
      */}
      <dl className="mt-14 md:mt-16 flex flex-wrap gap-x-10 gap-y-5 max-w-2xl border-t border-rule pt-6">
        <Fact
          value={total === null ? '—' : total}
          label={t('систем')}
          numeric
        />
        <Fact value="1" label={t('бүртгэл, бүх систем')} numeric />
        <Fact value={t('Монгол')} label={t('хэл дээр бүрэн')} />
      </dl>
      </div>
    </section>
  )
}

function Fact({ value, label, numeric = false }) {
  return (
    <div>
      {/*
        Хэмжээ 400px-ээс доош 24px: «Монгол» гэсэн тооны биш утга 1/3
        баганад (≈99px) 30px-ээр бол фонт ачаалагдахаас өмнөх fallback
        метрикээр 2 мөр болж, дараа нь 1 мөр болоод layout shift үүсгэж
        байв. break-words нь 320px-ийн нөөц хамгаалалт.
      */}
      <dd
        className={`font-serif text-2xl xs:text-3xl sm:text-4xl leading-none break-words ${
          numeric ? 'tabular-nums' : ''
        }`}
      >
        {value}
      </dd>
      <dt className="mt-2 font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.14em] text-ink-soft">
        {label}
      </dt>
    </div>
  )
}

/* ══ Хэсгийн толгой — дугаартай editorial шошго ══════════════════════ */
function SectionHead({ index, label, title, desc }) {
  return (
    <div className="border-b border-rule pb-6">
      <p className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
        <span className="text-brand-text tabular-nums">{index}</span>
        {label}
      </p>
      {/*
        Шатлалын 2-р түвшин. Card-ийн гарчиг (h3) 36px хүртэл томордог тул
        хэсгийн гарчиг үүнээс ДЭЭГҮҮР байх ёстой: 72 → 48 → 36 → 24 → 16.
      */}
      <h2 className="mt-3 font-serif text-4xl md:text-5xl font-medium tracking-tight">
        {title}
      </h2>
      {desc && (
        <p className="mt-3 max-w-2xl text-sm sm:text-base leading-relaxed text-ink-soft text-pretty">
          {desc}
        </p>
      )}
    </div>
  )
}

/** Хэсгүүдийн нэгдсэн босоо зай — хуучнаас ~1.7 дахин том, амьсгалтай */
const SECTION = 'pt-20 md:pt-32 scroll-mt-20'

/* ══ Системүүд: бэлэн (онцлох) + удахгүй (card grid) ═════════════════ */
function Systems({ t, lang, apps, ready, soon }) {
  return (
    <section id="systems" className={`${WRAP} ${SECTION}`} data-reveal="out">
      <SectionHead
        index="I"
        label={t('Системүүд')}
        title={t('Одоо бэлэн')}
        desc={t(
          'Бүртгүүлмэгц идэвхжих систем. Дараагийнх нь каталогт бэлтгэгдэж байна.',
        )}
      />

      {apps === null ? (
        <SystemsSkeleton />
      ) : apps.length === 0 ? (
        <p className="mt-8 text-sm text-ink-soft">
          {t('Каталогт систем алга — платформын админд хандана уу.')}
        </p>
      ) : (
        <>
          <div
            className={`mt-8 grid gap-5 ${ready.length > 1 ? 'xl:grid-cols-2' : ''}`}
          >
            {ready.map((app, i) => (
              <FeaturedSystem key={app.key} app={app} index={i + 1} t={t} lang={lang} />
            ))}
          </div>

          {soon.length > 0 && (
            <div className="mt-16 md:mt-20" data-reveal="out">
              <p className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
                <span className="text-brand-text">II</span>
                {t('Удахгүй нэмэгдэх')}
              </p>
              <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {soon.map((app, i) => (
                  <SoonCard
                    key={app.key}
                    app={app}
                    index={ready.length + i + 1}
                    t={t}
                    lang={lang}
                  />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  )
}

/**
 * Ачаалалтын skeleton — эцсийн агуулгын өндрийг УРЬДЧИЛАН эзэлнэ, ингэж
 * apps ирэхэд хуудас доошоо түлхэгдэхгүй (layout shift 0).
 */
function SystemsSkeleton() {
  return (
    <div
      className="mt-8 animate-pulse motion-reduce:animate-none"
      aria-hidden="true"
    >
      {/*
       * Өндрүүд нь одоогийн каталогийн агуулга дээр БОДИТООР хэмжигдсэн
       * (360/640/768/1024px → 818/604/533/340px). Ингэснээр apps ирэхэд
       * хуудас доошоо түлхэгддэггүй. Каталогийн текст мэдэгдэхүйц урт/
       * богино болбол эдгээр тоог дахин хэмжиж тааруулна — зөвхөн
       * ачаалалтын хэсэг зуурын placeholder тул зөрүү нь эгзэгтэй биш.
       */}
      <div className="rounded-xl border border-rule bg-surface h-[818px] sm:h-[604px] md:h-[533px] lg:h-[340px]" />
      <div className="mt-16 md:mt-20">
        <div className="h-3 w-40 rounded bg-surface" />
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }, (_, i) => (
            <li
              key={i}
              className="h-[204px] sm:h-[207px] rounded-lg border border-rule bg-surface"
            />
          ))}
        </ul>
      </div>
    </div>
  )
}

/**
 * БЭЛЭН СИСТЕМ — хуудасны гол хавтан.
 * Дэвсгэрээс ялгарах гурван давхарга: илүү цайвар surface-raised,
 * хүчтэй хүрээ (rule-strong 3.23:1), зөөлөн сүүдэр. Зүүн ирмэгийн зураас
 * нь app-ийн өнгийг давтана.
 */
function FeaturedSystem({ app, index, t, lang }) {
  const Icon = appIcon(app.icon)
  const features = (APP_FEATURES[app.key] ?? []).slice(0, 6)
  return (
    <article
      data-testid="catalog-card"
      style={{ '--app': app.color }}
      className="relative overflow-hidden rounded-xl border border-rule-strong bg-surface-raised
        shadow-xl shadow-black/30 light:shadow-black/10"
    >
      {/* App-ийн accent — зүүн ирмэгийн зураас */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1.5 bg-[var(--app)]"
      />

      <div className="p-6 pl-7 sm:p-8 sm:pl-10 md:flex md:gap-10">
        <div className="md:w-72 md:shrink-0">
          <div className="flex items-start justify-between gap-4">
            <span
              className="w-16 h-16 rounded-xl flex items-center justify-center text-white shadow-lg shadow-[color:var(--app)]/30"
              style={{ backgroundColor: app.color }}
            >
              <Icon size={32} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span className="font-mono text-xs text-ink-soft tabular-nums">
              {String(index).padStart(2, '0')}
            </span>
          </div>

          <h3 className="mt-5 font-serif text-3xl md:text-4xl font-medium tracking-tight">
            {appName(app, lang)}
          </h3>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-ink-soft">
            {appNameAlt(app, lang)}
          </p>
          <p className="mt-4 text-sm leading-relaxed text-ink-soft text-pretty">
            {t(app.descriptionMn)}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-4">
            <Link
              to={`/apps/${app.key}`}
              className={`${CTA_PRIMARY} px-5 py-2.5 text-sm`}
            >
              {t('Дэлгэрэнгүй')}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link
              to="/signup"
              className={`rounded text-sm text-ink-soft underline underline-offset-4 hover:text-ink transition-colors motion-reduce:transition-none ${FOCUS}`}
            >
              {t('Үнэгүй эхлэх')}
            </Link>
          </div>
        </div>

        {features.length > 0 && (
          <ul className="mt-8 md:mt-0 md:flex-1 md:border-l md:border-rule md:pl-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4 content-start">
            {features.map((f) => (
              <li
                key={f}
                className="flex items-start gap-2.5 text-sm leading-relaxed"
              >
                <Check
                  size={16}
                  strokeWidth={2.25}
                  className="mt-0.5 shrink-0 text-[var(--app)]"
                  aria-hidden="true"
                />
                <span>{t(f)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  )
}

/**
 * УДАХГҮЙ НЭМЭГДЭХ СИСТЕМ — намхан, бүдэгдүү card.
 * ЗОРИУДААР интерактив БИШ (link биш, hover-гүй, cursor default) —
 * дарагдахгүй гэдэг нь мэдрэгдэнэ. App-ийн өнгө icon дээрээ амьд үлдэнэ,
 * бусад нь дэвсгэр рүү ухарна.
 */
function SoonCard({ app, index, t, lang }) {
  const Icon = appIcon(app.icon)
  return (
    <li
      data-testid="catalog-card"
      className="flex h-full cursor-default flex-col rounded-lg border border-rule bg-surface/60 p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
          style={{ backgroundColor: app.color }}
        >
          <Icon size={19} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <span className="font-mono text-[11px] text-ink-soft tabular-nums">
          {String(index).padStart(2, '0')}
        </span>
      </div>

      <h3 className="mt-4 font-medium leading-snug">{appName(app, lang)}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft line-clamp-2">
        {t(app.descriptionMn)}
      </p>

      {/* mt-auto: тайлбар 1 эсвэл 2 мөр болохоос үл хамааран badge-ууд
          эгнээндээ нэг шугамд зэрэгцэнэ */}
      <span className="mt-auto pt-4 self-start rounded border border-rule px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
        {t('Удахгүй')}
      </span>
    </li>
  )
}

/* ══ Яаж ажилладаг вэ — 3 алхам ══════════════════════════════════════ */
function HowItWorks({ t }) {
  const steps = [
    {
      n: '01',
      title: t('Бүртгүүл'),
      desc: t(
        'Байгууллагынхаа нэрээр бүртгэл үүсгэнэ. Карт шаардахгүй, хэдхэн минутын ажил.',
      ),
    },
    {
      n: '02',
      title: t('Системээ идэвхжүүл'),
      desc: t(
        'Каталогоос хэрэгтэй системээ сонгож идэвхжүүлнэ. Хэрэггүйг нь дараа нэмнэ.',
      ),
    },
    {
      n: '03',
      title: t('Багаа урь'),
      desc: t(
        'Ажилтнуудаа эрхийн зэрэглэлээр нэмж, хамтдаа нэг системд ажиллана.',
      ),
    },
  ]
  return (
    <section className={`${WRAP} ${SECTION}`} data-reveal="out">
      <SectionHead index="III" label={t('Яаж ажилладаг вэ')} title={t('Гурван алхам')} />
      <ol className="mt-8 grid gap-8 md:grid-cols-3 md:gap-10">
        {steps.map((s) => (
          /* border-t тавихгүй: SectionHead-ийн доод зураастай давхарлаж
             хоёр зэрэгцээ шугам үүсгэдэг. Дугаар нь шатлалыг хангалттай
             тэмдэглэнэ. */
          <li key={s.n}>
            <span className="font-mono text-xs tabular-nums text-brand-text">
              {s.n}
            </span>
            <h3 className="mt-3 font-serif text-2xl font-medium tracking-tight">
              {s.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft text-pretty">
              {s.desc}
            </p>
          </li>
        ))}
      </ol>
    </section>
  )
}

/* ══ Давуу тал — 4 зүйл (2×2) ════════════════════════════════════════ */
function Benefits({ t }) {
  const items = [
    {
      Icon: Languages,
      title: t('Монгол хэл дээр'),
      desc: t(
        'Бүх цэс, тайлан, баримт монголоор. Кирилл бүрэн дэмждэг фонтууд системд шингэсэн.',
      ),
    },
    {
      Icon: MapPin,
      title: t('Монголын бизнесийн онцлогт'),
      desc: t(
        'Дүүрэг-хороо, аймаг-сумын бүтэцлэгдсэн хаяг, төгрөгийн тооцоо, Excel-д кирилл зөв гарах тайлан.',
      ),
    },
    {
      Icon: KeyRound,
      title: t('Нэг бүртгэл, бүх систем'),
      desc: t(
        'Агуулахаас санхүү хүртэл нэг нэвтрэлтээр. Систем нэмэхэд дахин бүртгэх шаардлагагүй.',
      ),
    },
    {
      Icon: ShieldCheck,
      title: t('Байгууллага бүрийн дата тусгаарлагдсан'),
      desc: t(
        'Байгууллага тус бүрийн өгөгдөл мөрийн түвшинд хуваагдсан. Бусдын өгөгдөл харагдах боломжгүй.',
      ),
    },
  ]
  return (
    <section className={`${WRAP} ${SECTION}`} data-reveal="out">
      <SectionHead index="IV" label={t('Давуу тал')} title={t('Яагаад ocirrf')} />
      <ul className="mt-8 grid gap-x-10 gap-y-9 sm:grid-cols-2">
        {items.map(({ Icon, title, desc }) => (
          <li key={title} className="flex gap-4">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-rule bg-surface text-brand-text">
              <Icon size={19} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="font-medium leading-snug">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft text-pretty">
                {desc}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ══ Хаалтын CTA ═════════════════════════════════════════════════════ */
function ClosingCta({ t }) {
  return (
    <section className={`${WRAP} ${SECTION} pb-4`} data-reveal="out">
      <div className="rounded-xl border border-rule-strong bg-surface-raised px-6 py-14 text-center md:px-12 md:py-20 shadow-xl shadow-black/30 light:shadow-black/10">
        <h2 className="font-serif text-3xl md:text-5xl font-medium tracking-tight text-balance">
          {t('Байгууллагаа өнөөдөр бүртгэ')}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm sm:text-base leading-relaxed text-ink-soft text-pretty">
          {t(
            'Бүртгэл үнэгүй. Урсгал систем шууд идэвхжиж, багаараа ажиллаж эхлэх боломжтой.',
          )}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/signup" className={`${CTA_PRIMARY} px-6 py-3 text-base`}>
            {t('Үнэгүй эхлэх')}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <Link to="/login" className={`${CTA_GHOST} px-6 py-3 text-base`}>
            {t('Нэвтрэх')}
          </Link>
        </div>
        <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft">
          {t('Карт шаардахгүй')}
        </p>
      </div>
    </section>
  )
}

/* ══ Footer ══════════════════════════════════════════════════════════ */
function SiteFooter({ t }) {
  const link = `rounded text-ink-soft hover:text-ink transition-colors motion-reduce:transition-none ${FOCUS}`
  return (
    <footer className="mt-20 md:mt-32 border-t border-rule">
      <div
        className={`${WRAP} py-12 grid gap-10 sm:grid-cols-[1.6fr_1fr] md:gap-16`}
      >
        <div>
          <span className="font-serif text-xl font-medium tracking-tight">
            ocirrf
          </span>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-soft text-pretty">
            {t(
              'Монголын бизнесийн дотоод удирдлагын системүүд нэг платформ дээр.',
            )}
          </p>
        </div>

        <nav aria-label={t('landing.links')}>
          {/* Гарчгийн шатлалыг цэвэр байлгах: h1 → хэсгийн h2 → card-ийн h3.
              Footer-ийн шошго нь <nav aria-label>-аар аль хэдийн нэрлэгдсэн. */}
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
            {t('landing.links')}
          </p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <Link to="/login" className={link}>
                {t('Нэвтрэх')}
              </Link>
            </li>
            <li>
              <Link to="/signup" className={link}>
                {t('Бүртгүүлэх')}
              </Link>
            </li>
            <li>
              <a href="#systems" className={link}>
                {t('Системүүд')}
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-rule">
        <div className={`${WRAP} py-5 text-xs text-ink-soft`}>
          © {new Date().getFullYear()} ocirrf
        </div>
      </div>
    </footer>
  )
}
