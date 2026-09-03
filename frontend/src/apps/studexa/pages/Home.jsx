import { Navigate } from 'react-router'
import { useApi } from '../lib/useApi'
import { Loading, LoadError } from '../components/ui'
import Dashboard from './Dashboard'

/**
 * /studexa нүүр: багш (studexa.teach) → самбар, профайлгүй бол тохиргоо;
 * сурагч (studexa.portal) → портал; аль нь ч биш бол тайлбар.
 */
export default function Home() {
  const { data, error, loading, reload } = useApi('/studexa/me')
  if (loading) return <Loading />
  if (error) return <LoadError error={error} onRetry={reload} />
  if (data.canTeach) {
    return data.teacher ? <Dashboard /> : <Navigate to="/studexa/setup" replace />
  }
  if (data.canPortal) return <Navigate to="/studexa/portal" replace />
  return (
    <div className="max-w-md mx-auto py-20 text-center">
      <p className="font-serif text-2xl">Studexa</p>
      <p className="mt-2 text-sm text-ink-muted">
        Танд Studexa-гийн эрх алга. Багшаар ажиллах бол админаас «Studexa: багшаар ажиллах»
        эрх, сурагч бол «Studexa: сурагчийн портал» эрх авна уу.
      </p>
    </div>
  )
}
