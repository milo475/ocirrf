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

/** Илгээгдээгүй баталгаажуулалт нэмнэ (photo нь File/Blob хэлбэрээрээ) */
export async function enqueueComplete({ deliveryId, orderNo, success, note, photo }) {
  const db = await openDb()
  await tx(db, 'readwrite', (store) =>
    store.add({
      deliveryId,
      orderNo,
      success,
      note: note ?? '',
      photo: photo ?? null,
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
export async function flushQueue() {
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
        if (err && typeof err.status === 'number') {
          // Сервер хариулсан (давхар илгээлт г.м.) — дарааллаас хасна
          await tx(db, 'readwrite', (s) => s.delete(key))
          emitChanged()
        }
        // Сүлжээний алдаа — дараагийн оролдлогод үлдээнэ
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

/** App нээгдэх + online болох үед автоматаар илгээнэ (нэг л удаа бүртгэнэ) */
export function initOfflineQueue() {
  if (inited) return
  inited = true
  window.addEventListener('online', () => {
    void flushQueue()
  })
  void flushQueue()
}
