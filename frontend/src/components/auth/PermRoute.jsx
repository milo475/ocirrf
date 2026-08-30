import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../../context/AuthContext'
import { landingFor } from './RoleRoute'

/**
 * Permission-д суурилсан route хамгаалалт — Permission Panel-аас олгосон/
 * хассан эрхийг шууд дагана (RoleRoute-ын хатуу жагсаалтаас ялгаатай).
 * perm — нэг түлхүүр; anyOf — аль нэг нь байхад хангалттай;
 * allOf — бүгд байх шаардлагатай (backend-ийн олон түлхүүрт
 * @RequirePermission-тэй тааруулна).
 */
export default function PermRoute({ perm, anyOf, allOf }) {
  const { user, hasPerm } = useAuth()
  const { pathname } = useLocation()
  const allowed =
    user &&
    (allOf
      ? allOf.every(hasPerm)
      : anyOf
        ? anyOf.some(hasPerm)
        : hasPerm(perm))

  if (!allowed) {
    const to = landingFor(user, hasPerm)
    // Өөр рүүгээ буцаавал төгсгөлгүй давталт болно — тэр тохиолдолд
    // хоосон дэлгэц үзүүлэхийн оронд ойлгомжтой мессеж гаргана
    if (to === pathname) return <NoAccess />
    return <Navigate to={to} replace />
  }
  return <Outlet />
}

function NoAccess() {
  return (
    <div className="max-w-md mx-auto py-20 text-center">
      <p className="font-serif text-2xl">Хандах эрх байхгүй</p>
      <p className="mt-2 text-sm text-ink-muted">
        Танд одоогоор нээлттэй хуудас алга. Админд хандана уу.
      </p>
    </div>
  )
}
