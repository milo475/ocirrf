import { Navigate, Outlet } from 'react-router'
import { navFor } from '../../config/nav'
import { useAuth } from '../../context/AuthContext'

/** Хэрэглэгчийн эрхээс хамаарсан "нүүр" зам */
export function homeFor(role) {
  if (role === 'DRIVER') return '/deliveries'
  return '/'
}

/**
 * Эрх хүрэхгүй үед ХААШАА буцаах вэ (V5).
 *
 * Өмнө нь бүгдийг '/' руу буцаадаг байсан. Гэтэл '/' нь няравыг
 * '/warehouse' руу шиддэг тул тухайн эрхийг нь хасахад
 * '/' → '/warehouse' → '/' гэсэн ТӨГСГӨЛГҮЙ давталт үүсч апп бүхэлдээ
 * гацдаг байв. Одоо хэрэглэгчийн ЖИНХЭНЭ хүрч чадах цэснээс сонгоно;
 * юу ч байхгүй бол Тохиргоо (бүх нэвтэрсэн хүнд нээлттэй).
 */
export function landingFor(user, hasPerm) {
  if (!user) return '/login'
  if (user.role === 'DRIVER') return '/deliveries'
  const reachable = navFor(user, hasPerm).find((i) => i.path !== '/')
  return reachable?.path ?? '/settings'
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
