import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { homeFor } from '../components/auth/RoleRoute'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import AuthShell from '../components/auth/AuthShell'

/**
 * БАЙГУУЛЛАГЫН НЭЭЛТТЭЙ БҮРТГЭЛ (Multi-tenancy).
 *
 * Шинэ байгууллага нэр + админ хэрэглэгчээ бүртгүүлээд ХООСОН
 * системтэй шууд ажиллаж эхэлнэ: бараа, ажилтнаа өөрсдөө нэмнэ.
 * Login-той ижил шилэн карт (AuthShell) ашиглана.
 */
export default function Signup() {
  const { user, loading, registerOrg } = useAuth()
  const { t } = useLang()
  const navigate = useNavigate()

  const [orgName, setOrgName] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <main className="min-h-screen bg-bg text-ink-muted flex items-center justify-center font-mono text-sm">
        {t('ачаалж байна…')}
      </main>
    )
  }

  if (user) return <Navigate to={homeFor(user.role)} replace />

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    if (password !== password2) {
      setError(t('Нууц үг давталттайгаа таарахгүй байна'))
      return
    }
    setSubmitting(true)
    try {
      const created = await registerOrg({
        orgName,
        fullName,
        email,
        password,
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      })
      navigate(homeFor(created.role), { replace: true })
    } catch (err) {
      setError(err.message ?? 'Алдаа гарлаа')
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls =
    'w-full bg-bg border border-rule rounded px-3 py-2 text-sm focus:outline-none focus:border-ink-muted'
  const labelCls =
    'block text-xs uppercase tracking-wide text-ink-muted mb-1.5'

  return (
    <AuthShell>
      <div className="bg-surface/40 backdrop-blur-lg border border-rule/50 rounded-lg p-8 shadow-2xl shadow-black/40">
        <h1 className="font-serif text-3xl font-medium text-center">
          {t('Байгууллага бүртгүүлэх')}
        </h1>
        <p className="mt-2 text-center text-sm text-ink-muted">
          {t('Өөрийн байгууллагад зориулсан тусдаа систем нээгдэнэ')}
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="orgName" className={labelCls}>
              {t('Байгууллагын нэр')}
            </label>
            <input
              id="orgName"
              type="text"
              required
              minLength={2}
              maxLength={100}
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className={inputCls}
              placeholder={t('Жишээ: Мандал Трейд ХХК')}
            />
          </div>

          <div>
            <label htmlFor="fullName" className={labelCls}>
              {t('Таны нэр')}
            </label>
            <input
              id="fullName"
              type="text"
              required
              minLength={2}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="email" className={labelCls}>
              {t('Имэйл')}
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="phone" className={labelCls}>
              {t('Утас (заавал биш)')}
            </label>
            <input
              id="phone"
              type="tel"
              maxLength={30}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="password" className={labelCls}>
              {t('Нууц үг')}
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="password2" className={labelCls}>
              {t('Нууц үг давтах')}
            </label>
            <input
              id="password2"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className={inputCls}
            />
          </div>

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

        <p className="mt-4 text-center text-sm text-ink-muted">
          {t('Бүртгэлтэй юу?')}{' '}
          <Link
            to="/login"
            className="underline underline-offset-2 hover:text-ink"
          >
            {t('Нэвтрэх')}
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}
