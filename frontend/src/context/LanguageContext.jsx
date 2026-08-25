import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { setFormatLang } from '../lib/format'

/**
 * Хэлний систем. Түлхүүр нь ихэвчлэн МОНГОЛ эх текст өөрөө —
 * en толиос орчуулгаа авна, олдохгүй бол монголоороо үлдэнэ.
 * Хоёр өөр утгатай давхардсан үгэнд 'reason.order' маягийн түлхүүр
 * ашиглаж mn толидоо мөн бүртгэнэ. {var} орлуулга дэмжинэ.
 */
const DICT = {
  mn: {
    'stock.out': 'Дууссан',
    'reason.order': 'Захиалга',
    'table.range': '{from}–{to} / нийт {total}',
  },
  en: {
    // — Нэвтрэлт, бүрхүүл —
    'Нөөц ба захиалгын систем': 'Inventory & order system',
    'Имэйл': 'Email',
    'Нууц үг': 'Password',
    'Нэвтрэх': 'Log in',
    'Нэвтэрч байна…': 'Logging in…',
    'ачаалж байна…': 'loading…',
    'Самбар': 'Dashboard',
    'Бараа': 'Products',
    'Захиалга': 'Orders',
    'Үлдэгдэл': 'Stock',
    'Хэрэглэгчид': 'Users',
    'Тохиргоо': 'Settings',
    'Гарах': 'Log out',
    'Админ': 'Admin',
    'Оператор': 'Operator',
    'Харанхуй': 'Dark',
    'Цайвар': 'Light',
    'Тема солих': 'Toggle theme',

    // — Нийтлэг —
    'Хадгалах': 'Save',
    'Бүртгэх': 'Create',
    'Болих': 'Cancel',
    'Хаах': 'Close',
    'Дахин оролдох': 'Retry',
    'Тийм': 'Yes',
    'Баталгаажуулах': 'Confirm',
    'Нийт': 'Total',
    'Бүгд': 'All',
    'Хайлт': 'Search',
    'Огноо': 'Date',
    'Нэр': 'Name',
    'Утас': 'Phone',
    'Ангилал': 'Category',
    'Үнэ': 'Price',
    'Төлөв': 'Status',
    'Статус': 'Status',
    'Дүн': 'Amount',
    'Эрх': 'Role',
    'Шалтгаан': 'Reason',
    'Хэрэглэгч': 'User',
    'Юу ч алга': 'Nothing here',
    'table.range': '{from}–{to} of {total}',

    // — Самбар —
    'Нөөцийн эрүүл мэнд': 'Stock health',
    'бараа': 'items',
    'Эрсдэлд буй дүн': 'Value at risk',
    'Эрсдэлтэй бараа': 'Items at risk',
    'Дундаж оноо': 'Median score',
    '30 хоногт нөхөх': 'Restock in 30 days',
    '/ 4 дол.хон': '/ 4 wk',
    '— 4 дол.хон': '— 4 wk',
    'Нэгтгэсэн': 'Combined',
    'Категориор': 'By category',
    'эрсдэлийн босго': 'risk threshold',
    'Хяналтын жагсаалт — хамгийн эрсдэлтэй 8': 'Watchlist — top 8 at risk',
    'Сарын борл.': 'Mo. sales',
    'Оноо': 'Score',
    '13 дол.хон': '13 wk',
    'Уналт': 'Drawdown',
    'Дуусах': 'Runway',
    'Эргэц': 'Turnover',
    '7 хон. Δ': 'WoW Δ',
    'Сүүлд нөхсөн': 'Last restock',
    'Дараагийн': 'Next',
    'хон': 'd',
    'дх': 'wk',
    'Онооны задаргаа': 'Score breakdown',
    '13 долоо хоногийн хандлага': '13-week trend',
    'Нийлүүлэгч': 'Supplier',
    'Үлдэгдэл / захиалгын түвшин': 'Stock / reorder level',
    'Сарын борлуулалт': 'Monthly sales',
    'Дараагийн нөхөлт': 'Next restock',
    'хоног': 'days',
    'Суурь': 'Base',
    'Эцсийн оноо': 'Final score',
    'Үлдэгдлийн хүрэлцээ': 'Stock adequacy',
    'Зарлагын хурд': 'Outflow rate',
    'Нөхөн дүүргэлтийн хоцролт': 'Restock delay',
    'Өгөгдөл ачаалж чадсангүй': 'Failed to load data',
    'Бараа бүртгэгдээгүй байна': 'No products registered yet',
    'Эхлээд бараагаа бүртгэж, үлдэгдэл оруулна уу':
      'Register products and add stock first',

    // — Бараа —
    '+ Шинэ бараа': '+ New product',
    'Нэр эсвэл SKU…': 'Name or SKU…',
    'Бүх ангилал': 'All categories',
    'stock.out': 'Out of stock',
    'Идэвхтэй': 'Active',
    'Идэвхгүй': 'Inactive',
    'Засах': 'Edit',
    'Идэвхгүй болгох': 'Deactivate',
    'Шинэ бараа': 'New product',
    'Ангилалгүй': 'No category',
    'Үнэ (₮)': 'Price (₮)',
    'Шинэ бараа бүртгэгдлээ': 'Product created',
    'Бараа шинэчлэгдлээ': 'Product updated',
    '«{name}» идэвхгүй боллоо': '“{name}” deactivated',
    '«{name}» барааг идэвхгүй болгох уу? Жагсаалтад харагдахгүй болно, хуучин захиалгууд хадгалагдана.':
      'Deactivate “{name}”? It will disappear from lists; past orders are preserved.',
    'Бараа олдсонгүй': 'No products found',
    'Жагсаалт ачаалж чадсангүй': 'Failed to load list',

    // — Үлдэгдэл тохируулга —
    'Үлдэгдэл тохируулах': 'Adjust stock',
    'Одоогийн үлдэгдэл:': 'Current stock:',
    'Өөрчлөлт (+ орлого / − зарлага)': 'Change (+ in / − out)',
    'Жишээ: агуулахын тооллого': 'e.g. inventory count',
    '«{name}» үлдэгдэл: {qty} {unit}': '“{name}” stock: {qty} {unit}',

    // — Захиалга —
    '+ Шинэ захиалга': '+ New order',
    '№, нэр, утас…': 'No., name, phone…',
    '№': 'No.',
    'Харилцагч': 'Customer',
    'Үүсгэсэн': 'Created by',
    'Захиалга олдсонгүй': 'No orders found',
    'Шинэ': 'New',
    'Баталгаажсан': 'Confirmed',
    'Бэлтгэж буй': 'Preparing',
    'Бэлэн': 'Ready',
    'Дууссан': 'Completed',
    'Цуцлагдсан': 'Cancelled',
    'Бэлтгэж эхлэх': 'Start preparing',
    'Бэлэн болсон': 'Mark ready',
    'Дуусгах': 'Complete',
    'Цуцлах': 'Cancel',
    '← Захиалгын жагсаалт': '← Orders list',
    'Хаяг': 'Address',
    'Хүргэлтийн хаяг': 'Delivery address',
    'Тэмдэглэл': 'Note',
    'Нэгж үнэ': 'Unit price',
    'Тоо': 'Qty',
    'Захиалга цуцлах': 'Cancel order',
    'Үлдэгдэл буцаан нэмэгдэнэ. Цуцлах уу?':
      'Stock will be restored. Cancel this order?',
    'Статус шинэчлэгдлээ': 'Status updated',
    'Захиалга цуцлагдаж, үлдэгдэл буцаан нэмэгдлээ':
      'Order cancelled, stock restored',
    'Захиалга ачаалж чадсангүй': 'Failed to load order',

    // — Шинэ захиалга —
    'Шинэ захиалга': 'New order',
    'Хүргэлтийн заавар г.м. (заавал биш)': 'Delivery notes etc. (optional)',
    'Бараа хайх — нэр эсвэл SKU…': 'Search items — name or SKU…',
    'Олдсонгүй': 'Not found',
    '— нэмэгдсэн': '— added',
    'Бараа сонгогдоогүй': 'No items selected',
    'Дээрх хайлтаар бараа нэмнэ үү': 'Add items using the search above',
    '⚠ Үлдэгдэл: {n}': '⚠ In stock: {n}',
    'Мөр устгах': 'Remove row',
    'Захиалга үүсгэх': 'Create order',
    'Захиалга {no} үүслээ': 'Order {no} created',

    // — Үлдэгдлийн хөдөлгөөн —
    'Үлдэгдлийн хөдөлгөөн': 'Stock movements',
    'Бүх бараа': 'All products',
    'Өөрчлөлт': 'Change',
    'Холбоос': 'Reference',
    'Захиалга харах': 'View order',
    'reason.order': 'Order',
    'Цуцлалт': 'Cancellation',
    'Эхний орлого': 'Initial stock',
    'Гар тохируулга': 'Manual',
    'Хөдөлгөөн бүртгэгдээгүй': 'No movements recorded',
    'Түүх ачаалж чадсангүй': 'Failed to load history',

    // — Хэрэглэгчид —
    '+ Шинэ хэрэглэгч': '+ New user',
    'Бүртгэсэн': 'Created',
    'Бүтэн нэр': 'Full name',
    'Хамгийн багадаа 6 тэмдэгт': 'At least 6 characters',
    'Шинэ хэрэглэгч': 'New user',
    '«{name}» бүртгэгдлээ': '“{name}” created',
    '«{name}» идэвхжлээ': '“{name}” activated',
    'Хэрэглэгч идэвхгүй болгох': 'Deactivate user',
    '«{name}» цаашид нэвтэрч чадахгүй болно. Идэвхгүй болгох уу?':
      '“{name}” will no longer be able to log in. Deactivate?',
    'Өөрийгөө идэвхгүй болгох боломжгүй': 'You cannot deactivate yourself',
    'Хэрэглэгч алга': 'No users',

    // — Тохиргоо —
    'Хэл': 'Language',
    'Тема': 'Theme',
    'Интерфэйсийн хэлийг сонгоно. Серверийн алдааны мессежүүд одоогоор зөвхөн монголоор ирдэг.':
      'Choose the interface language. Server error messages are currently in Mongolian only.',
  },
}

const LanguageContext = createContext(null)

function applyVars(str, vars) {
  if (!vars) return str
  let out = str
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, String(v))
  }
  return out
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem('lang') ?? 'mn'
    } catch {
      return 'mn'
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('lang', lang)
    } catch {
      /* хадгалагдахгүй бол session дотроо л үйлчилнэ */
    }
    setFormatLang(lang)
    document.documentElement.lang = lang
  }, [lang])

  const t = useCallback(
    (key, vars) => {
      const s = DICT[lang]?.[key] ?? DICT.mn[key] ?? key
      return applyVars(s, vars)
    },
    [lang],
  )

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLang-ыг LanguageProvider дотор л хэрэглэнэ')
  return ctx
}
