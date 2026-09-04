import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  Layers,
  LayoutDashboard,
  Megaphone,
  Settings2,
  StickyNote,
  Table2,
  Users,
} from 'lucide-react'

/**
 * STUDEXA app-ийн sidebar цэс. Багшийн хуудсууд studexa.teach, сурагчийн
 * портал studexa.portal эрхээр харагдана (AppShell navFor-оор шүүнэ).
 */
export const STUDEXA_NAV = [
  { key: 'sx-home', label: 'Хяналт самбар', icon: LayoutDashboard, path: '/studexa', end: true, perm: 'studexa.teach' },
  { key: 'sx-students', label: 'Сурагчид', icon: Users, path: '/studexa/students', perm: 'studexa.teach' },
  { key: 'sx-attendance', label: 'Ирц бүртгэх', icon: ClipboardCheck, path: '/studexa/attendance', perm: 'studexa.teach' },
  { key: 'sx-gradebook', label: 'Дүнгийн нэгтгэл', icon: Table2, path: '/studexa/gradebook', perm: 'studexa.teach' },
  { key: 'sx-schedule', label: 'Хичээлийн хуваарь', icon: CalendarDays, path: '/studexa/schedule', perm: 'studexa.teach' },
  { key: 'sx-homework', label: 'Гэрийн даалгавар', icon: BookOpen, path: '/studexa/homework', perm: 'studexa.teach' },
  { key: 'sx-academics', label: 'Хичээл · Улирал', icon: Layers, path: '/studexa/academics', perm: 'studexa.teach' },
  { key: 'sx-announcements', label: 'Зарлал', icon: Megaphone, path: '/studexa/announcements', perm: 'studexa.teach' },
  { key: 'sx-notes', label: 'Тэмдэглэл', icon: StickyNote, path: '/studexa/notes', perm: 'studexa.teach' },
  { key: 'sx-teacher', label: 'Багшийн тохиргоо', icon: Settings2, path: '/studexa/settings', perm: 'studexa.teach' },
  { key: 'sx-portal', label: 'Миний самбар', icon: GraduationCap, path: '/studexa/portal', perm: 'studexa.portal' },
]

/**
 * STUDEXA (app 11) — багшийн систем. Django Studexa-г платформын модулийн
 * стандартаар (README «Шинэ app нэмэх») шилжүүлсэн: key нь Application.key-тэй
 * ижил, route мод lazy chunk (app-studexa-*.js).
 *
 * publicRoutes — нэвтрэлтГҮЙ хуудас (сурагчийн бүртгэл): App.jsx платформын
 * бүрхүүл ProtectedRoute-ийн гадна, lazy-гаар угсарна. Зам нь mountPath
 * дотор байсан ч react-router статик замыг "/studexa/*"-аас түрүүлж таардаг.
 */
export const studexaManifest = {
  key: 'studexa',
  nameMn: 'Studexa',
  icon: 'graduation-cap',
  color: '#4f46e5',
  basePath: '/studexa',
  mountPath: '/studexa/*',
  loadRoutes: () => import('./routes'),
  navItems: STUDEXA_NAV,
  requiredPermissions: [],
  publicRoutes: [{ path: '/studexa/register', load: () => import('./pages/Register') }],
}
