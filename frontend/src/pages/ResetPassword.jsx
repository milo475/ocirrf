import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import AuthShell from '../components/auth/AuthShell'
import { useLang } from '../context/LanguageContext'
import { api } from '../lib/api'

/**
 * И-мэйлээр ирсэн сэргээх холбоосын хуудас: /reset-password?token=…
 * Шинэ нууц үгээ хоёр удаа оруулаад POST /auth/reset-password.
 * Нэвтрэлтгүй (ProtectedRoute-ийн гадна).
 */
export default function ResetPassword() {
  const { t } = useLang()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    if (password !== confirm) {
      setError(t('Нууц үг таарахгүй байна'))
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, password } })
      setDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <div className="bg-surface/40 backdrop-blur-lg border border-rule/50 rounded-lg p-6 shadow-2xl shadow-black/40">
        <h1 className="font-serif text-2xl font-medium">{t('Шинэ нууц үг тохируулах')}</h1>

        {!token ? (
          <p className="mt-4 text-sm text-alarm">
            {t('Сэргээх холбоос буруу байна. И-мэйл дэх холбоосоор дахин орно уу.')}
          </p>
        ) : done ? (
          <>
            <p className="mt-4 text-sm text-safe">✓ {t('Нууц үг амжилттай солигдлоо. Шинэ нууц үгээрээ нэвтэрнэ үү.')}</p>
            <Link to="/login" className="mt-5 block w-full text-center bg-ink text-bg rounded py-2 text-sm font-medium hover:opacity-90">
              {t('Нэвтрэх')}
            </Link>
          </>
        ) : (
          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <p className="text-sm text-ink-muted">{t('Шинэ нууц үгээ хоёр удаа оруулна уу (хамгийн багадаа 6 тэмдэгт).')}</p>
            <label className="block">
              <span className="block text-xs uppercase tracking-wide text-ink-muted mb-1.5">{t('Шинэ нууц үг')}</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required autoFocus
                className="w-full bg-bg border border-rule rounded px-3 py-2 text-sm focus:outline-none focus:border-ink-muted" />
            </label>
            <label className="block">
              <span className="block text-xs uppercase tracking-wide text-ink-muted mb-1.5">{t('Шинэ нууц үг (давтах)')}</span>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={6} required
                className="w-full bg-bg border border-rule rounded px-3 py-2 text-sm focus:outline-none focus:border-ink-muted" />
            </label>
            {error && <p className="text-sm text-alarm border border-alarm rounded px-3 py-2">{error}</p>}
            <button type="submit" disabled={submitting}
              className="w-full bg-ink text-bg rounded py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity">
              {submitting ? t('Хадгалж байна…') : t('Нууц үг солих')}
            </button>
          </form>
        )}
        <p className="mt-4 pt-4 border-t border-rule/50 text-center text-sm text-ink-muted">
          <Link to="/login" className="underline underline-offset-2 hover:text-ink">← {t('Нэвтрэх хуудас')}</Link>
        </p>
      </div>
    </AuthShell>
  )
}
