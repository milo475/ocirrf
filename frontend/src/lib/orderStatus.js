/**
 * Backend-ийн ALLOWED_TRANSITIONS-тэй ижил логик (orders.service.ts).
 * Зөвхөн харагдах товчнуудыг тодорхойлно — жинхэнэ шалгалт backend-д.
 */
export const TRANSITIONS = {
  NEW: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
}

/** Шилжилтийн товчны бичвэр (үйл үг хэлбэрээр) */
export const TRANSITION_LABELS = {
  CONFIRMED: 'Баталгаажуулах',
  PREPARING: 'Бэлтгэж эхлэх',
  READY: 'Бэлэн болсон',
  COMPLETED: 'Дуусгах',
  CANCELLED: 'Цуцлах',
}
