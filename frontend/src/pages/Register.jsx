import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { homeFor } from '../components/auth/RoleRoute'
import Input from '../components/ui/Input'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'

/** Харилцагчийн бүртгэл — амжилтад шууд нэвтэрч /portal руу */
export default function Register() {
  const { user, register } = useAuth()
  const { t } = useLang()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    password2: '',
  })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to={homeFor(user.role)} replace />

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    if (form.password !== form.password2) {
      setError(t('Нууц үг таарахгүй байна'))
      return
    }
    setSubmitting(true)
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      })
      navigate('/portal', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-bg text-ink flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div>
          <h1 className="font-serif text-4xl font-medium text-center">ursGAL</h1>
          <p className="mt-2 text-center text-sm text-ink-muted">
            {t('Хэрэглэгчийн бүртгэл')}
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <Input
              id="rg-name"
              label={t('Нэр')}
              required
              value={form.name}
              onChange={set('name')}
            />
            <Input
              id="rg-email"
              label={t('Имэйл')}
              type="email"
              required
              value={form.email}
              onChange={set('email')}
              className="font-mono"
            />
            <Input
              id="rg-phone"
              label={t('Утас')}
              required
              inputMode="numeric"
              pattern="\d{8}"
              title={t('Утасны дугаар 8 оронтой тоо байна')}
              value={form.phone}
              onChange={set('phone')}
              placeholder="99112233"
              className="font-mono"
            />
            <Input
              id="rg-pass"
              label={t('Нууц үг')}
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={set('password')}
            />
            <Input
              id="rg-pass2"
              label={t('Нууц үг давтах')}
              type="password"
              required
              value={form.password2}
              onChange={set('password2')}
              error={
                form.password2 && form.password !== form.password2
                  ? t('Нууц үг таарахгүй байна')
                  : undefined
              }
            />

            {error && (
              <p className="text-sm text-alarm border border-alarm rounded px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-ink text-bg rounded py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity flex items-center justify-center gap-2"
            >
              {submitting && (
                <span className="inline-block w-4 h-4 border-2 border-bg border-t-transparent rounded-full animate-spin" />
              )}
              {submitting ? t('Бүртгэж байна…') : t('Бүртгүүлэх')}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-ink-muted">
            {t('Бүртгэлтэй юу?')}{' '}
            <Link
              to="/login"
              className="text-accent underline underline-offset-2"
            >
              {t('Нэвтрэх')}
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
