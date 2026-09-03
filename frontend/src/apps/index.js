import { lazy } from 'react'
import { studexaManifest } from './studexa/manifest'
import { ursgalManifest } from './ursgal/manifest'

/**
 * ПЛАТФОРМ ДЭЭРХ APP-УУДЫН БҮРТГЭЛ (frontend тал).
 *
 * Backend-ийн App Registry (Application хүснэгт) юу ХАРАГДАХЫГ, энэ
 * жагсаалт юу АЖИЛЛАХЫГ тодорхойлно: серверээс идэвхтэй гэж ирсэн app
 * локал манифесттайгаа key-ээрээ холбогдож route/nav-аа угсарна.
 * Шинэ app нэмэх бүрэн дараалал README-ийн "Шинэ app нэмэх" хэсэгт.
 */
export const APP_MANIFESTS = [ursgalManifest, studexaManifest]

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

/**
 * Одоогийн зам аль app-ийнх вэ — AppShell nav/гарчгаа үүгээр сонгоно.
 * Prefix-тэй ("/<key>/*") app-уудыг л таниулна; таарахгүй бол null
 * (= цөм ursgal, түүхэн "/*" mount).
 */
export function manifestForPath(pathname) {
  return (
    APP_MANIFESTS.find((m) => {
      if (m.mountPath === '/*') return false
      const base = m.mountPath.replace(/\/\*$/, '')
      return pathname === base || pathname.startsWith(`${base}/`)
    }) ?? null
  )
}

/**
 * Манифестийн `publicRoutes` ({path, load}) — нэвтрэлтГҮЙ хуудсууд
 * (жишээ: Studexa-гийн сурагчийн бүртгэл). App.jsx ProtectedRoute-ийн
 * гадна lazy-гаар угсарна; компонент lazyRoutesFor-той ижил шалтгаанаар
 * кэшлэгдэнэ.
 */
const publicCache = new Map()

export function publicRoutesForApps() {
  return APP_MANIFESTS.flatMap((m) =>
    (m.publicRoutes ?? []).map((r) => {
      const key = `${m.key}:${r.path}`
      let Component = publicCache.get(key)
      if (!Component) {
        Component = lazy(r.load)
        publicCache.set(key, Component)
      }
      return { key, path: r.path, Component }
    }),
  )
}
