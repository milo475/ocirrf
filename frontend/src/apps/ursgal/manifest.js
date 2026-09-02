import { NAV_ITEMS } from '../../config/nav'
import { ursgalRoutes } from './routes'

/**
 * УРСГАЛ app-ийн манифест — модулийн стандартын анхны хэрэгжүүлэлт.
 * Талбарууд (бүх app ижил бүтэцтэй):
 *   key                 — App Registry-ийн Application.key-тэй ЯГ ижил
 *   nameMn, icon, color — switcher/launcher-ийн fallback (сервер эх сурвалж)
 *   basePath            — app руу орох үндсэн зам
 *   routes              — <Route> мод (платформ бүрхүүл AppShell дотор угсарна)
 *   navItems            — sidebar цэс ({perm|anyPerm|roles|requires} шүүлттэй)
 *   requiredPermissions — app-д орох босго эрх (хоосон = нэвтэрсэн бүгд)
 */
export const ursgalManifest = {
  key: 'ursgal',
  nameMn: 'Урсгал',
  icon: 'boxes',
  color: '#8b2635',
  basePath: '/dashboard',
  routes: ursgalRoutes,
  navItems: NAV_ITEMS,
  requiredPermissions: [],
}
