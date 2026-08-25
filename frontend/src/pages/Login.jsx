import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'

export default function Login() {
  const { user, loading, login } = useAuth()
  const { t } = useLang()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Session сэргээгдэж дуусаагүй бол хүлээнэ
  if (loading) {
    return (
      <main className="min-h-screen bg-bg text-ink-muted flex items-center justify-center font-mono text-sm">
        {t('ачаалж байна…')}
      </main>
    )
  }

  // Аль хэдийн нэвтэрсэн бол нүүр рүү
  if (user) return <Navigate to="/" replace />

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message ?? 'Алдаа гарлаа')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-bg text-ink flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="bg-surface border border-rule rounded-lg p-8">
          <h1 className="font-serif text-4xl font-medium text-center">ursGAL</h1>
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
                placeholder="admin@ursgal.mn"
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
        </div>
      </div>
    </main>
  )
}
