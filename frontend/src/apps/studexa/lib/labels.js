/** Studexa-гийн enum → монгол шошго (backend enum нэрстэй ижил) */
export const WEEKDAYS = ['Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба', 'Ням']

export const SCHOOL_TYPES = [
  ['UNIVERSITY', 'Их сургууль', '🎓'],
  ['SCHOOL', 'Ерөнхий боловсролын сургууль', '🏫'],
  ['ACADEMY', 'Академи', '📚'],
  ['PRIVATE', 'Хувийн багш', '👤'],
]
export const SCHOOL_LABEL = Object.fromEntries(SCHOOL_TYPES.map(([k, v]) => [k, v]))

export const ATT_STATUS = {
  PRESENT: { label: 'Ирсэн', cls: 'text-safe border-safe/40 bg-safe/12' },
  LATE: { label: 'Хоцорсон', cls: 'text-status-preparing border-status-preparing/40 bg-status-preparing/12' },
  ABSENT: { label: 'Тасалсан', cls: 'text-alarm border-alarm/40 bg-alarm/10' },
}

export const HW_STATUS = {
  DONE: { label: 'Хийсэн', cls: 'text-safe border-safe/40 bg-safe/12' },
  IN_PROGRESS: { label: 'Хийж буй', cls: 'text-status-new border-status-new/40 bg-status-new/12' },
  PENDING: { label: 'Хүлээгдэж буй', cls: 'text-status-preparing border-status-preparing/40 bg-status-preparing/12' },
}

export const PAY_STATUS = {
  PAID: { label: 'Төлсөн', cls: 'text-safe border-safe/40 bg-safe/12' },
  PENDING: { label: 'Хүлээгдэж буй', cls: 'text-status-preparing border-status-preparing/40 bg-status-preparing/12' },
  OVERDUE: { label: 'Хоцорсон', cls: 'text-alarm border-alarm/40 bg-alarm/10' },
}

export const GENDER = { MALE: 'Эрэгтэй', FEMALE: 'Эмэгтэй' }

/** Сурагчийн төлөв — төгссөн/шилжсэн нь жагсаалт, ирц, нэгтгэлд орохгүй */
export const STUDENT_STATUS = {
  ACTIVE: { label: 'Суралцаж буй', cls: 'text-safe border-safe/40 bg-safe/12' },
  GRADUATED: { label: 'Төгссөн', cls: 'text-status-new border-status-new/40 bg-status-new/12' },
  LEFT: { label: 'Шилжсэн', cls: 'text-ink-muted border-rule bg-bg' },
}

export const LESSON_COLORS = [
  ['indigo', 'Индиго'],
  ['green', 'Ногоон'],
  ['purple', 'Ягаан'],
]

/** Хуваарийн блокийн өнгө (Studexa-гийн style.css-тэй ижил) */
export const LESSON_COLOR_STYLE = {
  indigo: { backgroundColor: '#eef2ff', borderColor: '#c7d2fe', color: '#4f46e5' },
  green: { backgroundColor: '#ccfbf1', borderColor: '#99f6e4', color: '#0f766e' },
  purple: { backgroundColor: '#f3e8ff', borderColor: '#e9d5ff', color: '#7e22ce' },
}

/** Өнөөдрийн огноо ХЭРЭГЛЭГЧИЙН цагийн бүсээр (toISOString нь UTC — шөнө 00–08 цагт өчигдөр өгдөг) */
export function localDateStr() {
  return new Date().toLocaleDateString('en-CA')
}

export function fmtDate(d) {
  return d ? String(d).replace(/-/g, '.') : '—'
}

export function fmtDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-CA').replace(/-/g, '.')} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}
