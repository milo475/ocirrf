import { lazy } from 'react'
import { ursgalManifest } from './ursgal/manifest'

/**
 * ПЛАТФОРМ ДЭЭРХ APP-УУДЫН БҮРТГЭЛ (frontend тал).
 *
 * Backend-ийн App Registry (Application хүснэгт) юу ХАРАГДАХЫГ, энэ
 * жагсаалт юу АЖИЛЛАХЫГ тодорхойлно: серверээс идэвхтэй гэж ирсэн app
 * локал манифесттайгаа key-ээрээ холбогдож route/nav-аа угсарна.
 * Шинэ app нэмэх бүрэн дараалал README-ийн "Шинэ app нэмэх" хэсэгт.
 */
export const APP_MANIFESTS = [ursgalManifest]

export function manifestFor(key) {
  return APP_MANIFESTS.find((m) => m.key === key) ?? null
}

/**
 * Манифестийн `loadRoutes`-оос React.lazy компонент үүсгэж КЭШЛЭНЭ.
 * Render бүрт шинээр lazy() үүсгэвэл React өмнөх модыг хаяж дахин
 * mount хийдэг (хуудасны state алдагдана) — тиймээс app бүрт ганц.
 */
const lazyCache = new Map()

export function lazyRoutesFor(manifest) {
  let comp = lazyCache.get(manifest.key)
  if (!comp) {
    comp = lazy(manifest.loadRoutes)
    lazyCache.set(manifest.key, comp)
  }
  return comp
}

/**
 * Платформ бүрхүүлд угсрах дараалал: prefix-тэй ("/<key>/*") app-ууд
 * эхэнд, үндсэн түвшний ("/*", ursgal) app хамгийн сүүлд — эс тэгвэл
 * "/*" бүх замыг залгиж бусад app хэзээ ч таарахгүй.
 */
export function manifestsInMountOrder() {
  return [...APP_MANIFESTS].sort(
    (a, b) => Number(a.mountPath === '/*') - Number(b.mountPath === '/*'),
  )
}
