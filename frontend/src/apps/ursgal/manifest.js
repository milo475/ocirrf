import { CORE_APP_HOME, NAV_ITEMS } from '../../config/nav'

/**
 * УРСГАЛ app-ийн манифест — модулийн стандартын анхны хэрэгжүүлэлт.
 * Талбарууд (бүх app ижил бүтэцтэй):
 *   key                 — App Registry-ийн Application.key-тэй ЯГ ижил
 *   nameMn, icon, color — switcher/launcher-ийн fallback (сервер эх сурвалж)
 *   basePath            — app руу орох үндсэн зам
 *   mountPath           — app-ийн route-ууд платформ бүрхүүлд хаана суух вэ.
 *                         Шинэ app: "/<key>/*" (жишээ "/sankhuu/*"). Ursgal нь
 *                         түүхэн шалтгаанаар үндсэн түвшинд ("/*") — App.jsx
 *                         үүнийг хамгийн СҮҮЛД угсардаг тул бусад app-ийн
 *                         prefix-тэй замууд түрүүлж таарна.
 *   loadRoutes          — () => import('./routes'): route модыг LAZY ачаална.
 *                         Ингэснээр app бүр өөрийн chunk (app-<key>-*.js)-тэй,
 *                         хэрэглэгч тухайн app руу ороход л татагдана.
 *                         Статик `routes:` талбар ХЭРЭГЛЭХГҮЙ — үндсэн bundle
 *                         бүх app-ийн кодыг агуулах болно.
 *   navItems            — sidebar цэс ({perm|anyPerm|roles|requires} шүүлттэй)
 *   requiredPermissions — app-д орох босго эрх (хоосон = нэвтэрсэн бүгд)
 */
export const ursgalManifest = {
  key: 'ursgal',
  nameMn: 'Урсгал',
  icon: 'boxes',
  color: '#8b2635',
  basePath: CORE_APP_HOME,
  mountPath: '/*',
  loadRoutes: () => import('./routes'),
  navItems: NAV_ITEMS,
  requiredPermissions: [],
}
