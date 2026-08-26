import { useState } from 'react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { api } from '../../lib/api'

/** Нэр, утас, нууц үг солино — имэйл солигдохгүй */
export default function PortalProfile() {
  const { user } = useAuth()
  const { t } = useLang()
  const toast = useToast()

  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    if (password && password !== password2) {
      setError(t('Нууц үг таарахгүй байна'))
      return
    }
    setSaving(true)
    try {
      await api('/portal/profile', {
        method: 'PATCH',
        body: {
          ...(name.trim() ? { name: name.trim() } : {}),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          ...(password ? { password } : {}),
        },
      })
      toast.show(t('Профайл хадгалагдлаа'))
      setPassword('')
      setPassword2('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-sm">
      <h1 className="font-serif text-4xl font-medium">{t('Профайл')}</h1>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Input id="pf-email" label={t('Имэйл')} value={user?.email ?? ''} disabled className="font-mono opacity-60" />
        <Input
          id="pf-name"
          label={t('Нэр')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          id="pf-phone"
          label={t('Утас')}
          inputMode="numeric"
          pattern="\d{8}"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t('(солих бол шинэ дугаар)')}
          className="font-mono"
        />
        <Input
          id="pf-pass"
          label={t('Шинэ нууц үг')}
          type="password"
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('(солих бол)')}
        />
        {password && (
          <Input
            id="pf-pass2"
            label={t('Нууц үг давтах')}
            type="password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            error={
              password2 && password !== password2
                ? t('Нууц үг таарахгүй байна')
                : undefined
            }
          />
        )}
        {error && (
          <p className="text-sm text-alarm border border-alarm rounded px-3 py-2">
            {error}
          </p>
        )}
        <Button type="submit" loading={saving} className="w-full">
          {t('Хадгалах')}
        </Button>
      </form>
    </div>
  )
}
