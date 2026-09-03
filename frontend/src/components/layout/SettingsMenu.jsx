import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Check, Settings as SettingsIcon } from 'lucide-react'
import { useLang } from '../../context/LanguageContext'
import { useTheme } from '../../context/ThemeContext'

/**
 * ХЭЛ + ТЕМА нэг товчны цаана (нийтийн хуудсуудад).
 *
 * ЯАГААД popover, яагаад тусдаа хоёр товч биш: landing-ийн navbar 360px
 * дээр аль хэдийн хязгаартаа хүрсэн (лого + тема + 2 линк). Хэлний товчийг
 * дэргэд нь нэмбэл хэвтээ гүйлт үүснэ. Нэг gear товч нь өмнөх
 * «◐ Харанхуй» шошготой товчноос НАРИЙН тул өргөн бүр чөлөөлнө.
 *
 * Нэвтрээгүй хүнд `/settings` хуудас хүрэхгүй (ProtectedRoute) тул нүүр
 * хуудас дээр хэл сольж чадах өөр арга байгаагүй.
 *
 * ХҮРТЭЭМЖ: `aria-expanded` + `aria-controls`, сонголтууд нь
 * `aria-pressed`-тэй жирийн товчнууд (Tab-аар шилжинэ, Enter/Space-ээр
 * сонгогдоно — arrow-key-ийн гар логик шаардахгүй). Escape хааж focus-ыг
 * товч руу буцаана, гадна дарахад хаагдана.
 *
 * Сонголт нь `LanguageContext` / `ThemeContext`-д хадгалагдана — тэднийх
 * localStorage-д бичдэг тул дараагийн ирэлтэд хэвээр үлдэнэ.
 *
 * БАЙРЛАЛ: панель товчны зүүн ирмэгээр тогтоод, нээгдэхдээ дэлгэцээс
 * халиж байвал ӨӨРӨӨ шилждэг. Тогтмол тал сонгож болохгүй нь хэмжилтээр
 * тогтоогдсон: gear нь navbar-ын баруун бүлгийн эхэнд байдаг тул түүний
 * байрлал хажуугийн линкүүдийн ӨРГӨНӨӨС хамаарч хэл болгонд өөр болно
 * («Нэвтрэх/Бүртгүүлэх» vs «Log in/Sign up»). Тиймээс right-0 нь монголд,
 * left-0 нь англид халина. Динамик залруулга нь хэл, орчуулга, дэлгэцийн
 * өргөн ямар ч байсан панелийг дотор нь барина.
 */

const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-text'

export default function SettingsMenu() {
  const { lang, setLang, t } = useLang()
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const [shift, setShift] = useState(0)
  const panelId = useId()
  const wrapRef = useRef(null)
  const btnRef = useRef(null)
  const panelRef = useRef(null)

  // Гадна дарах / Escape → хаах
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      btnRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // Дэлгэцээс халихаас сэргийлж байрлалаа өөрөө залруулна.
  // Хэмжихдээ ОДООГИЙН shift-ийг хасаж «эх» байрлал руу буцаана — эс тэгвэл
  // хэмжилт бүр өмнөх залруулгаа дахин тооцож хэлбэлзэнэ.
  // eslint-disable-next-line react(set-state-in-effect) -- DOM-ыг ХЭМЖИЖ
  // байрлалыг залруулах нь render дотор тооцоологдох боломжгүй (панелийн
  // бодит өргөн/байрлал зурагдсаны дараа л мэдэгдэнэ). Нэг удаа тогтоод
  // зогсдог: dx === shift болмогц дахин setState хийхгүй.
  useLayoutEffect(() => {
    if (!open) {
      setShift(0)
      return
    }
    const el = panelRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const M = 8
    const left = r.left - shift
    const right = r.right - shift
    let dx = 0
    if (right > window.innerWidth - M) dx = window.innerWidth - M - right
    if (left + dx < M) dx = M - left
    if (dx !== shift) setShift(dx)
  }, [open, shift])

  // Клавиатураар нээхэд эхний сонголт руу focus
  useEffect(() => {
    if (open) panelRef.current?.querySelector('button')?.focus()
  }, [open])

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t('Тохиргоо')}
        title={t('Тохиргоо')}
        className={`flex h-8 w-8 items-center justify-center rounded border border-rule text-ink-soft
          hover:text-ink hover:bg-surface transition-colors motion-reduce:transition-none ${FOCUS}`}
      >
        <SettingsIcon size={16} aria-hidden="true" />
      </button>

      {open && (
        <div
          id={panelId}
          ref={panelRef}
          role="group"
          aria-label={t('Тохиргоо')}
          style={shift ? { transform: `translateX(${shift}px)` } : undefined}
          className="absolute left-0 top-full z-40 mt-2 w-52 rounded-lg border border-rule-strong
            bg-surface p-2 shadow-xl shadow-black/40 light:shadow-black/15"
        >
          <Choice
            label={t('Хэл')}
            value={lang}
            onChange={setLang}
            options={[
              { value: 'mn', label: 'Монгол' },
              { value: 'en', label: 'English' },
            ]}
          />
          <Choice
            className="mt-1 border-t border-rule pt-2"
            label={t('Тема')}
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'dark', label: t('Харанхуй') },
              { value: 'light', label: t('Цайвар') },
            ]}
          />
        </div>
      )}
    </div>
  )
}

/**
 * Нэг сонголтын багц — босоо жагсаалт, сонгогдсоныг ✓-ээр тэмдэглэнэ.
 * Зөвхөн өнгөөр биш ЗУРАГТ тэмдгээр ялгасан (өнгө хараагүй хүнд ч
 * уншигдана, WCAG 1.4.1).
 */
function Choice({ label, options, value, onChange, className = '' }) {
  return (
    <div className={className}>
      <p className="px-2 pb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
        {label}
      </p>
      {options.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm
              transition-colors motion-reduce:transition-none ${FOCUS} ${
                active
                  ? 'bg-surface-raised text-ink'
                  : 'text-ink-soft hover:bg-surface-raised hover:text-ink'
              }`}
          >
            <span>{o.label}</span>
            {active && (
              <Check
                size={14}
                strokeWidth={2.5}
                className="shrink-0 text-brand-text"
                aria-hidden="true"
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
