import { formatMoneyRound } from './format'

/**
 * DM-ийн хариу мессеж угсрах (V5).
 *
 * Захиалга баталгаажсаны дараа борлуулагч үйлчлүүлэгч рүү
 * Instagram/Facebook-аар буцааж бичдэг мессеж. Өмнө нь гараар
 * бичдэг байсан — өдөрт 20 захиалга бол өдөрт 20 удаа.
 *
 * Загвар нь тохиргоонд байдаг тул компани өөрийн үгээр өөрчилж
 * болно. Энд зөвхөн орлуулга хийнэ.
 */

/** Загварт орох боломжтой түлхүүрүүд — тохиргооны тусламжид харагдана */
export const DM_TOKENS = [
  ['{нэр}', 'Хүлээн авагчийн нэр'],
  ['{дугаар}', 'Захиалгын дугаар'],
  ['{бараа}', 'Барааны жагсаалт (мөр мөрөөр)'],
  ['{нийт}', 'Нийт төлөх дүн'],
  ['{хаяг}', 'Хүргэх хаяг'],
  ['{данс}', 'Төлбөрийн заавар — төлсөн бол баярлалаа гэж солигдоно'],
  ['{утас}', 'Компанийн утас'],
  ['{компани}', 'Компанийн нэр'],
]

/**
 * Төлбөрийн хэсэг.
 *
 * Аль хэдийн төлсөн хүнээс дахин мөнгө нэхэх нь эвгүй тул төлөв
 * бүрт өөр текст өгнө. Данс тохируулаагүй бол хоосон биш —
 * «холбогдоно» гэж хэлнэ, эс тэгвэл хэрэглэгч юу хийхээ мэдэхгүй.
 */
function paymentBlock(order, s) {
  const due = Number(order.totalAmount) - Number(order.paidAmount ?? 0)

  if (due <= 0) {
    // Товч — загварын төгсгөлд «Баярлалаа» аль хэдийн байдаг
    return 'Төлбөр бүрэн хүлээн авсан ✓'
  }

  const bank = [s.bankName, s.bankAccount].filter(Boolean).join(' · ')
  if (!bank) {
    return `Төлөх дүн: ${formatMoneyRound(due)}\nТөлбөрийн мэдээллийг удахгүй илгээнэ.`
  }

  const lines = [`Төлбөрөө шилжүүлнэ үү: ${formatMoneyRound(due)}`, bank]
  if (s.bankHolder) lines.push(`Хүлээн авагч: ${s.bankHolder}`)
  return lines.join('\n')
}

/** «• moringa 210g × 2 — 240,000₮» хэлбэрээр */
function itemLines(order) {
  const lines = (order.items ?? []).map(
    (i) =>
      `• ${i.productName} × ${i.qty} — ${formatMoneyRound(i.lineTotal)}`,
  )
  if (Number(order.deliveryFee) > 0) {
    lines.push(`• Хүргэлт — ${formatMoneyRound(order.deliveryFee)}`)
  }
  return lines.join('\n')
}

/**
 * Загвар + захиалга → илгээхэд бэлэн текст.
 *
 * @param order GET /orders/:id-ийн бүтэн хариу
 * @param settings GET /settings
 */
export function buildDmMessage(order, settings = {}) {
  const map = {
    '{нэр}': order.customerName || 'Сайн байна уу',
    '{дугаар}': order.orderNo ?? '',
    '{бараа}': itemLines(order),
    '{нийт}': formatMoneyRound(order.totalAmount),
    '{хаяг}': order.fullAddress ?? '',
    '{данс}': paymentBlock(order, settings),
    '{утас}': settings.companyPhone || '',
    '{компани}': settings.companyName || '',
  }

  const lines = (settings.dmTemplate || '').split('\n')
  const out = []

  for (const line of lines) {
    let filled = line
    for (const [token, value] of Object.entries(map)) {
      filled = filled.split(token).join(value)
    }

    // ГАНЦ ТҮЛХҮҮРЭЭС бүрдсэн мөр хоосон болбол мөрийг нь хаяна, мөн
    // өмнөх «Хүргэх хаяг:» маягийн ТОВЬЁГ хамт хаяна. Эс тэгвэл
    // үйлчлүүлэгч рүү толгойтой, доор нь юу ч байхгүй мессеж явна.
    const hadToken = /\{[^}]+\}/.test(line)
    const isLoneToken = /^\s*\{[^}]+\}\s*$/.test(line)

    if (isLoneToken && filled.trim() === '') {
      const prev = out[out.length - 1]
      if (prev !== undefined && prev.trimEnd().endsWith(':')) out.pop()
      continue
    }

    // «Холбоо барих:» гэж товьёг болж хоцорсон мөрийг хаяна — утга нь
    // хоосон болсон гэсэн үг (жишээ нь компанийн утас тохируулаагүй).
    if (hadToken && /:\s*$/.test(filled)) continue

    out.push(filled)
  }

  // Хаясан мөрөөс үлдсэн давхар хоосон зайг цэгцэлнэ
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
