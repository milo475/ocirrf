import { useEffect, useState } from 'react'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'
import { api } from '../lib/api'

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

      <SystemSettings t={t} />
    </div>
  )
}

/** Системийн тохиргоо — settings.edit эрхтэйд л харагдана */
function SystemSettings({ t }) {
  const { hasPerm } = useAuth()
  const toast = useToast()
  const canEdit = hasPerm('settings.edit')

  const [values, setValues] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!canEdit) return
    api('/settings')
      .then(setValues)
      .catch(() => {})
  }, [canEdit])

  if (!canEdit || !values) return null

  const allowCancel = values.allowCustomerCancel === 'true'

  async function save() {
    setSaving(true)
    try {
      const fresh = await api('/settings', { method: 'PUT', body: values })
      setValues(fresh)
      toast.show(t('Тохиргоо хадгалагдлаа'))
    } catch (e) {
      toast.show(e.message, { type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mt-12 border-t border-rule pt-8 max-w-md">
      <p className="text-xs uppercase tracking-wide text-ink-muted mb-4">
        {t('Системийн тохиргоо')}
      </p>
      <div className="space-y-4">
        <Input
          id="st-company"
          label={t('Компанийн нэр')}
          value={values.companyName}
          onChange={(e) =>
            setValues((v) => ({ ...v, companyName: e.target.value }))
          }
        />
        <Input
          id="st-phone"
          label={t('Компанийн утас')}
          value={values.companyPhone}
          onChange={(e) =>
            setValues((v) => ({ ...v, companyPhone: e.target.value }))
          }
          className="font-mono"
        />
        <label className="flex items-center justify-between gap-4 py-1 cursor-pointer">
          <span className="text-sm">
            {t('Харилцагч шинэ захиалгаа цуцлах боломжтой')}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={allowCancel}
            aria-label={t('Харилцагч шинэ захиалгаа цуцлах боломжтой')}
            onClick={() =>
              setValues((v) => ({
                ...v,
                allowCustomerCancel: allowCancel ? 'false' : 'true',
              }))
            }
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
              allowCancel ? 'bg-accent' : 'bg-rule'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-bg transition-all ${
                allowCancel ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </button>
        </label>
        <Button onClick={save} loading={saving} className="w-full">
          {t('Хадгалах')}
        </Button>
      </div>
    </section>
  )
}
