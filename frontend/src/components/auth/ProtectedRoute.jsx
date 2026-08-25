import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'

/** Нэвтрээгүй бол /login руу */
export default function ProtectedRoute() {
  const { user, loading } = useAuth()
  const { t } = useLang()

  if (loading) {
    return (
      <div className="min-h-screen bg-bg text-ink-muted flex items-center justify-center font-mono text-sm">
        {t('ачаалж байна…')}
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}
