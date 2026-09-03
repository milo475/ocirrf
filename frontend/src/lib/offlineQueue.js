/**
 * Offline баталгаажуулалтын дараалал (V4-10).
 * Сүлжээгүй үед жолоочийн complete хүсэлт IndexedDB-д (зурагтайгаа blob-оор)
 * хадгалагдаж, online болмогц автоматаар илгээгдэнэ.
 *
 * Event-үүд:
 *  - 'offline-queue:changed' — дарааллын тоо өөрчлөгдөх бүрт
 *  - 'offline-queue:flushed' — амжилттай илгээгдсэний дараа (detail.sent)
 */

import { apiUpload } from './api'

const DB_NAME = 'ocirrf-offline'
const STORE = 'completeQueue'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const out = fn(t.objectStore(STORE))
    t.oncomplete = () => resolve(out?.result ?? out)
    t.onerror = () => reject(t.error)
  })
}

function emitChanged() {
  window.dispatchEvent(new Event('offline-queue:changed'))
}

/**
 * Илгээгдээгүй баталгаажуулалт нэмнэ (photo нь File/Blob хэлбэрээрээ).
 *
 * `userId` нь ЗААВАЛ: IndexedDB нь төхөөрөмжийнх, гарахад цэвэрлэгддэггүй.
 * Хамтын утсан дээр жолооч А офлайн баталгаажуулаад гарч, жолооч Б орвол
 * `online` эвэнт А-гийн бичлэгүүдийг Б-гийн токеноор илгээж, сервер
 * татгалзаж, доорх алдаа боловсруулалт тэднийг устгадаг байв.
 */
export async function enqueueComplete({
  deliveryId,
  orderNo,
  success,
  note,
  photo,
  userId,
}) {
  const db = await openDb()
  await tx(db, 'readwrite', (store) =>
    store.add({
      deliveryId,
      orderNo,
      success,
      note: note ?? '',
      photo: photo ?? null,
      userId: userId ?? null,
      createdAt: Date.now(),
    }),
  )
  db.close()
  emitChanged()
}

/** Дараалалд хүлээгдэж буй тоо */
export async function pendingCount() {
  try {
    const db = await openDb()
    const count = await new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).count()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    db.close()
    return count
  } catch {
    return 0
  }
}

let flushing = false

/**
 * Дарааллыг илгээнэ. Илгээгдсэн бүртгэл устаж, бүтэлгүйтвэл (сервер 4xx —
 * жишээ нь аль хэдийн DELIVERED) мөн хасагдана; сүлжээний алдаанд үлдэнэ.
 */
export async function flushQueue(currentUserId = null) {
  if (flushing || !navigator.onLine) return { sent: 0 }
  flushing = true
  let sent = 0
  try {
    const db = await openDb()
    const entries = await new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).openCursor()
      const out = []
      req.onsuccess = () => {
        const cur = req.result
        if (cur) {
          out.push({ key: cur.key, value: cur.value })
          cur.continue()
        } else resolve(out)
      }
      req.onerror = () => reject(req.error)
    })

    for (const { key, value } of entries) {
      // ӨӨР ХЭРЭГЛЭГЧИЙН бичлэгийг илгээхгүй, бас устгахгүй — эзэн нь
      // дахин нэвтрэхэд илгээгдэнэ. (userId-гүй хуучин бичлэгүүд хэвээр.)
      if (value.userId && currentUserId && value.userId !== currentUserId) {
        continue
      }
      try {
        await apiUpload(`/deliveries/${value.deliveryId}/complete`, {
          success: String(value.success),
          ...(value.note ? { note: value.note } : {}),
          ...(value.photo ? { photo: value.photo } : {}),
        })
        sent++
        await tx(db, 'readwrite', (s) => s.delete(key))
        emitChanged()
      } catch (err) {
        const status =
          err && typeof err.status === 'number' ? err.status : null
        /**
         * ЗӨВХӨН ЭЦСИЙН алдаанд устгана (V5 засвар).
         *
         * Өмнө нь ЯМАР Ч тоон статустай алдаанд бичлэгийг устгадаг байв.
         * `api` нь бүх амжилтгүй хариунд тоон `status` шиддэг тул 401
         * (session дууссан) болон 500 (серверийн түр алдаа) ч устгалд
         * ордог байсан: жолооч өдөржин офлайн ажиллаад, холбогдох үед
         * refresh token нь хугацаа нь дуусчихсан бол БҮХ баталгаажуулалт
         * зурагтайгаа IndexedDB-ээс устаж, хэнд ч мэдэгдэхгүй байв.
         *
         * Одоо зөвхөн дахин оролдоод ч өөрчлөгдөхгүй хариултад устгана
         * (4xx — гэхдээ нэвтрэлт/хугацаа/хязгаарын кодуудаас бусад).
         */
        const permanent =
          status !== null &&
          status >= 400 &&
          status < 500 &&
          status !== 401 &&
          status !== 403 &&
          status !== 408 &&
          status !== 429
        if (permanent) {
          await tx(db, 'readwrite', (s) => s.delete(key))
          emitChanged()
        }
        // Сүлжээ / нэвтрэлт / серверийн алдаа — дараагийн оролдлогод үлдээнэ
      }
    }
    db.close()
  } catch {
    /* IndexedDB боломжгүй орчинд юу ч хийхгүй */
  } finally {
    flushing = false
  }
  if (sent > 0) {
    window.dispatchEvent(
      new CustomEvent('offline-queue:flushed', { detail: { sent } }),
    )
  }
  return { sent }
}

let inited = false
/** Идэвхтэй хэрэглэгч — `online` эвэнт хожим асахад ч зөв эзнийг мэдэхийн тулд */
let activeUserId = null

/**
 * App нээгдэх + online болох үед автоматаар илгээнэ (нэг л удаа бүртгэнэ).
 * `userId` нь солигдоход шинэчлэгдэнэ — хамтын төхөөрөмж дээр өмнөх
 * хэрэглэгчийн дараалал шинэ хэрэглэгчийн токеноор илгээгдэхгүй.
 */
export function initOfflineQueue(userId = null) {
  activeUserId = userId
  if (inited) {
    void flushQueue(activeUserId)
    return
  }
  inited = true
  window.addEventListener('online', () => {
    void flushQueue(activeUserId)
  })
  void flushQueue(activeUserId)
}
