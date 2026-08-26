import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../../context/AuthContext'
import { homeFor } from './RoleRoute'

/**
 * Permission-д суурилсан route хамгаалалт — Permission Panel-аас олгосон/
 * хассан эрхийг шууд дагана (RoleRoute-ын хатуу жагсаалтаас ялгаатай).
 * perm — нэг түлхүүр; anyOf — аль нэг нь байхад хангалттай.
 */
export default function PermRoute({ perm, anyOf }) {
  const { user, hasPerm } = useAuth()
  const allowed = user && (anyOf ? anyOf.some(hasPerm) : hasPerm(perm))
  if (!allowed) {
    return <Navigate to={homeFor(user?.role)} replace />
  }
  return <Outlet />
}
