import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { homeFor } from '../components/auth/RoleRoute'
import Modal from '../components/ui/Modal'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import { api } from '../lib/api'
import AuthShell from '../components/auth/AuthShell'

export default function Login() {
  const { user, loading, login } = useAuth()
  const { t } = useLang()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)
  const [company, setCompany] = useState(null)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotError, setForgotError] = useState(null)
  const [forgotBusy, setForgotBusy] = useState(false)

  function openForgot() {
    setForgotOpen(true)
    setForgotSent(false)
    setForgotError(null)
    setForgotEmail(email)
    if (!company) {
      api('/settings/company')
        .then(setCompany)
        .catch(() => setCompany({}))
    }
  }

  /** И-мэйлээр сэргээх холбоос хүсэх — и-мэйл байгаа эсэхээс үл хамааран ижил хариу */
  async function submitForgot(e) {
    e.preventDefault()
    setForgotError(null)
    setForgotBusy(true)
    try {
      await api('/auth/forgot-password', { method: 'POST', body: { email: forgotEmail } })
      setForgotSent(true)
    } catch (err) {
      setForgotError(err.message)
    } finally {
      setForgotBusy(false)
    }
  }

  // Session сэргээгдэж дуусаагүй бол хүлээнэ
  if (loading) {
    return (
      <main className="min-h-screen bg-bg text-ink-muted flex items-center justify-center font-mono text-sm">
        {t('ачаалж байна…')}
      </main>
    )
  }

  // Аль хэдийн нэвтэрсэн бол эрхийнхээ нүүр рүү (DRIVER → /deliveries)
  if (user)
    return (
      <Navigate
        to={user.mustChangePassword ? '/change-password' : homeFor(user)}
        replace
      />
    )

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const loggedIn = await login(email, password)
      // Түр нууц үгтэй бол эхлээд солиулна (V4-06)
      navigate(
        loggedIn.mustChangePassword
          ? '/change-password'
          : homeFor(loggedIn),
        { replace: true },
      )
    } catch (err) {
      setError(err.message ?? 'Алдаа гарлаа')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <div>
        {/* Шилэн карт: доорх зураг бүдгэрч харагдана (V5).
            `backdrop-blur` нь ард талыг нь бүдгэрүүлдэг тул
            зураг дээр ч текст цэвэр уншигдана. */}
        <div className="bg-surface/40 backdrop-blur-lg border border-rule/50 rounded-lg p-8 shadow-2xl shadow-black/40">
          <h1 className="font-serif text-4xl font-medium text-center">ocirrf</h1>
          <p className="mt-2 text-center text-sm text-ink-muted">
            {t('Нөөц ба захиалгын систем')}
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs uppercase tracking-wide text-ink-muted mb-1.5"
              >
                {t('Имэйл')}
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-bg border border-rule rounded px-3 py-2 text-sm focus:outline-none focus:border-ink-muted"
                placeholder="admin@ocirrf.mn"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs uppercase tracking-wide text-ink-muted mb-1.5"
              >
                {t('Нууц үг')}
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-bg border border-rule rounded px-3 py-2 text-sm focus:outline-none focus:border-ink-muted"
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
              {submitting ? t('Нэвтэрч байна…') : t('Нэвтрэх')}
            </button>
          </form>

          <p className="mt-2 text-center text-sm">
            <button
              type="button"
              onClick={openForgot}
              className="text-ink-muted underline underline-offset-2 hover:text-ink"
            >
              {t('Нууц үг мартсан?')}
            </button>
          </p>

          <p className="mt-4 pt-4 border-t border-rule/50 text-center text-sm text-ink-muted">
            {t('Шинэ байгууллага уу?')}{' '}
            <Link
              to="/signup"
              className="underline underline-offset-2 hover:text-ink"
            >
              {t('Бүртгүүлэх')}
            </Link>
          </p>
        </div>
      </div>

      <Modal
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        title={t('Нууц үг мартсан?')}
      >
        {forgotSent ? (
          <p className="text-sm text-safe">
            ✓{' '}
            {t(
              'Хэрэв энэ и-мэйл бүртгэлтэй бол сэргээх холбоос илгээгдлээ. Захидлаа (спам хавтсаа ч) шалгана уу — холбоос 30 минут хүчинтэй.',
            )}
          </p>
        ) : (
          <form onSubmit={submitForgot} className="space-y-3">
            <p className="text-sm text-ink-muted">
              {t('Бүртгэлтэй и-мэйл хаягаа оруулбал нууц үг сэргээх холбоос илгээнэ.')}
            </p>
            <input
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              required
              autoFocus
              placeholder="you@example.mn"
              className="w-full bg-bg border border-rule rounded px-3 py-2 text-sm focus:outline-none focus:border-ink-muted"
            />
            {forgotError && (
              <p className="text-sm text-alarm border border-alarm rounded px-3 py-2">{forgotError}</p>
            )}
            <button
              type="submit"
              disabled={forgotBusy}
              className="w-full bg-ink text-bg rounded py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60"
            >
              {forgotBusy ? t('Илгээж байна…') : t('Сэргээх холбоос илгээх')}
            </button>
          </form>
        )}
        <p className="mt-4 pt-3 border-t border-rule/50 text-xs text-ink-muted">
          {t('И-мэйл хүлээж авахгүй бол админд хандаж түр нууц үг авна уу.')}
        </p>
        {company?.companyPhone && (
          <p className="mt-2 text-sm text-ink-muted">
            {t('Холбогдох утас')}:{' '}
            <span className="font-mono text-ink">{company.companyPhone}</span>
          </p>
        )}
      </Modal>
    </AuthShell>
  )
}
