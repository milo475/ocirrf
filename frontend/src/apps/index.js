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
