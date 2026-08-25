import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../../context/AuthContext'

/** Хэрэглэгчийн эрхээс хамаарсан "нүүр" зам */
export function homeFor(role) {
  return role === 'DRIVER' ? '/deliveries' : '/'
}

/**
 * Эрхийн route хамгаалалт: roles жагсаалтад байхгүй эрхтэй хэрэглэгчийг
 * өөрийнх нь нүүр рүү буцаана. ProtectedRoute-ийн ДОТОР ашиглагдана
 * (user null байх үеийг ProtectedRoute аль хэдийн шийдсэн).
 */
export default function RoleRoute({ roles }) {
  const { user } = useAuth()
  if (!user || !roles.includes(user.role)) {
    return <Navigate to={homeFor(user?.role)} replace />
  }
  return <Outlet />
}
