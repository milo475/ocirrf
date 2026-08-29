import { useState } from 'react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { api } from '../../lib/api'

/**
 * Нэр, утас, нууц үг солино — имэйл солигдохгүй.
 *
 * Нууц үг нь ТУСДАА маягт бөгөөд /auth/change-password руу явна:
 * тэр endpoint хуучин нууц үгийг шалгаж, бүх session-ыг унтрааж,
 * шинэ хос token буцаадаг тул хэрэглэгч системээс гарахгүй.
 */
export default function PortalProfile() {
  const { user, applyAuth, patchUser } = useAuth()
  const { t } = useLang()
  const toast = useToast()

  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [oldPassword, setOldPassword] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [changing, setChanging] = useState(false)
  const [pwError, setPwError] = useState(null)

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      // Серверийн хариуг ХЭРЭГЛЭНЭ — context шинэчлэгдэж цэсэнд шинэ нэр гарна
      const saved = await api('/portal/profile', {
        method: 'PATCH',
        body: {
          ...(name.trim() ? { name: name.trim() } : {}),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
        },
      })
      patchUser({ name: saved.name, phone: saved.phone })
      setName(saved.name ?? '')
      setPhone(saved.phone ?? '')
      toast.show(t('Профайл хадгалагдлаа'))
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function onChangePassword(e) {
    e.preventDefault()
    setPwError(null)
    if (password !== password2) {
      setPwError(t('Нууц үг таарахгүй байна'))
      return
    }
    setChanging(true)
    try {
      const data = await api('/auth/change-password', {
        method: 'POST',
        body: { oldPassword, newPassword: password },
      })
      applyAuth(data)
      setOldPassword('')
      setPassword('')
      setPassword2('')
      toast.show(t('Нууц үг солигдлоо'))
    } catch (err) {
      setPwError(err.message)
    } finally {
      setChanging(false)
    }
  }

  return (
    <div className="max-w-sm">
      <h1 className="font-serif text-4xl font-medium">{t('Профайл')}</h1>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Input
          id="pf-email"
          label={t('Имэйл')}
          value={user?.email ?? ''}
          disabled
          className="font-mono opacity-60"
        />
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
          className="font-mono"
        />
        {error && (
          <p className="text-sm text-alarm border border-alarm rounded px-3 py-2">
            {error}
          </p>
        )}
        <Button type="submit" loading={saving} className="w-full">
          {t('Хадгалах')}
        </Button>
      </form>

      <form
        onSubmit={onChangePassword}
        className="mt-12 border-t border-rule pt-8 space-y-4"
      >
        <h2 className="font-serif text-2xl font-medium">
          {t('Нууц үг солих')}
        </h2>
        <Input
          id="pf-oldpass"
          label={t('Одоогийн нууц үг')}
          type="password"
          autoComplete="current-password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
        />
        <Input
          id="pf-pass"
          label={t('Шинэ нууц үг')}
          type="password"
          minLength={6}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          id="pf-pass2"
          label={t('Нууц үг давтах')}
          type="password"
          autoComplete="new-password"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          error={
            password2 && password !== password2
              ? t('Нууц үг таарахгүй байна')
              : undefined
          }
        />
        {pwError && (
          <p className="text-sm text-alarm border border-alarm rounded px-3 py-2">
            {pwError}
          </p>
        )}
        <Button
          type="submit"
          variant="ghost"
          loading={changing}
          disabled={!oldPassword || !password || password !== password2}
          className="w-full"
        >
          {t('Нууц үг солих')}
        </Button>
      </form>
    </div>
  )
}
