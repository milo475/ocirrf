import { Navigate, Outlet } from 'react-router'
import { navFor } from '../../config/nav'
import { useAuth } from '../../context/AuthContext'
import { isStudexaStudent } from '../../lib/studentUser'

/**
 * Хэрэглэгчийн эрхээс хамаарсан "нүүр" зам.
 *
 * ocirrf нь олон системийн платформ: нэвтэрсний дараа ХАБ (/launcher —
 * каталогийн 10 системийн card) дээр буугаад системээ сонгоно. «Урсгал»
 * нь тэдгээрийн нэг. Жолоочийн mobile урсгал л шууд хүргэлт рүүгээ
 * (хаб нь түүнд нэмэлт алхам).
 */
export function homeFor(userOrRole) {
  const user = typeof userOrRole === 'object' ? userOrRole : null
  const role = user ? user.role : userOrRole
  // Studexa-гийн сурагч: цөм app-д хийх ажилгүй тул шууд өөрийн портал руу
  if (user && isStudexaStudent(user)) return '/studexa/portal'
  if (role === 'DRIVER') return '/deliveries'
  return '/launcher'
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
  if (isStudexaStudent(user)) return '/studexa/portal'
  if (user.role === 'DRIVER') return '/deliveries'
  const reachable = navFor(user, hasPerm).find((i) => i.path !== '/dashboard')
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
    return <Navigate to={homeFor(user)} replace />
  }
  return <Outlet />
}
