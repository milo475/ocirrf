/**
 * Mock өгөгдөл — backend-ийн GET /api/dashboard/stock-health хариутай ЯГ ижил
 * бүтэцтэй (ProductHealth[]). Алхам 13 дээр нэг мөрөөр солигдоно.
 *
 * Инвариантууд (файлын төгсгөлд console.assert-ээр шалгагдана):
 *  - products.length === 75
 *  - 55 + Σ drivers.points === stockHealth (бүх бараанд)
 *  - healthHistory.length === 13, сүүлийн утга === stockHealth
 */

// Seeded PRNG — дахин ачаалахад өгөгдөл өөрчлөгдөхгүй
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(20260825)
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
const between = (min, max) => min + rnd() * (max - min)
const int = (min, max) => Math.floor(between(min, max + 1))
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// Бодит seed категориудтай ижил нэрс (спекийн Хүнс/Ундаа/Ахуй-г төслийн
// жинхэнэ ангилалд буулгав) — тоо: 35 / 22 / 18 = 75
const CATEGORIES = [
  {
    name: 'Хүнс',
    count: 35,
    sales: [500_000, 8_000_000],
    names: ['Цагаан будаа', 'Сүү', 'Талх', 'Элсэн чихэр', 'Гурил', 'Ургамлын тос', 'Өндөг', 'Гоймон', 'Цай', 'Кофе', 'Давс', 'Тараг', 'Бяслаг', 'Мах консерв', 'Овъёос', 'Үзэм', 'Шар будаа', 'Жимсний шүүс'],
    sizes: ['1кг', '5кг', '500г', '1л', '250г', '10ш'],
  },
  {
    name: 'Гэр ахуй',
    count: 22,
    sales: [200_000, 4_000_000],
    names: ['Угаалгын нунтаг', 'Аяга угаагч', 'Шүдний оо', 'Саван', 'Шампунь', 'Цаасан алчуур', 'Хог уут', 'Шүршигч цэвэрлэгч', 'Гутлын тос', 'Ариун цэврийн цаас'],
    sizes: ['3кг', '500мл', '75мл', '4ш', '1л', '10ш'],
  },
  {
    name: 'Электроник',
    count: 18,
    sales: [100_000, 3_000_000],
    names: ['LED чийдэн', 'Цэнэглэгч', 'Удлагч залгуур', 'Батерей', 'Чихэвч', 'USB кабель', 'Гар чийдэн', 'Термометр', 'Жижиг сэнс'],
    sizes: ['9Вт', 'Type-C', '3м', 'AA 4ш', '5м', '12Вт'],
  },
]

const SUPPLIERS = ['Таван Богд', 'Номин Трейд', 'Мөнх Импекс', 'Ай Си Ти Групп', 'Хишиг Трейд', 'Оргил Фүүдс']

/** Оноог DASHBOARD.md-ийн driver дүрмээр тооцно */
function buildDrivers(p, trendClass) {
  const drivers = []

  const ratio = p.stockQty / p.reorderLevel
  drivers.push({
    label: 'Үлдэгдлийн хүрэлцээ',
    points: ratio >= 2 ? 25 : ratio >= 1 ? 10 : ratio >= 0.5 ? -10 : -30,
  })

  // Зарлагын хурд трэнд ангиллаас хамаарна
  drivers.push({
    label: 'Зарлагын хурд',
    points: trendClass === 'sharp' ? -15 : trendClass === 'decline' ? -15 : rnd() < 0.35 ? 8 : 0,
  })

  const days = p._daysSinceRestock
  drivers.push({
    label: 'Нөхөн дүүргэлтийн хоцролт',
    points: days < 14 ? 10 : days <= 30 ? 0 : -12,
  })

  drivers.push({
    label: 'Эргэц',
    points:
      p.turnoverRate === null
        ? 0
        : p.turnoverRate > 0.7
          ? 12
          : p.turnoverRate >= 0.3
            ? 5
            : -8,
  })

  return drivers
}

/** 13 долоо хоногийн түүх — сүүлийн утга ЯГ stockHealth */
function buildHistory(stockHealth, trendClass) {
  const history = [stockHealth]
  let value = stockHealth
  for (let i = 0; i < 12; i++) {
    // Хуучин руу ухарна: буурдаг бараа өмнө нь ӨНДӨР байсан
    const step =
      trendClass === 'sharp'
        ? i < 4
          ? between(6, 12) // сүүлийн 4 долоо хоногт огцом унасан
          : between(-1.5, 1.5)
        : trendClass === 'decline'
          ? between(1, 3.5)
          : between(-2.5, 2.5)
    value = clamp(value + step, 0, 100)
    history.unshift(Math.round(value))
  }
  return history
}

function generate() {
  const products = []
  let skuNo = 1000

  for (const cat of CATEGORIES) {
    for (let i = 0; i < cat.count; i++) {
      const roll = rnd()
      const trendClass = roll < 0.15 ? 'sharp' : roll < 0.35 ? 'decline' : 'stable'

      const reorderLevel = int(5, 40)
      // Эрсдэлтэй ангилалд үлдэгдэл багаар
      const stockQty =
        trendClass === 'sharp'
          ? int(0, Math.ceil(reorderLevel * 0.6))
          : trendClass === 'decline'
            ? int(Math.ceil(reorderLevel * 0.4), Math.ceil(reorderLevel * 1.4))
            : int(reorderLevel, reorderLevel * 3)

      const daysSinceRestock =
        trendClass === 'stable' ? int(1, 25) : int(10, 55)
      const now = Date.now()
      const DAY = 86_400_000
      const turnoverRate = rnd() < 0.06 ? null : Math.round(between(0.05, 0.95) * 100) / 100

      const p = {
        id: `mock-${skuNo}`,
        sku: `UG-${skuNo}`,
        name: `${pick(cat.names)} ${pick(cat.sizes)}`,
        category: cat.name,
        monthlySales: Math.round(between(cat.sales[0], cat.sales[1]) / 1000) * 1000,
        stockQty,
        reorderLevel,
        supplier: pick(SUPPLIERS),
        lastRestocked: new Date(now - daysSinceRestock * DAY).toISOString(),
        nextRestockDate: new Date(now + int(3, 30) * DAY).toISOString(),
        turnoverRate,
        _daysSinceRestock: daysSinceRestock,
      }

      const drivers = buildDrivers(p, trendClass)
      const raw = 55 + drivers.reduce((a, d) => a + d.points, 0)
      const stockHealth = clamp(raw, 0, 100)
      // Clamp-ийн зөрүүг сүүлийн driver-т шингээж инвариантыг хадгална
      if (stockHealth !== raw) drivers[drivers.length - 1].points += stockHealth - raw

      delete p._daysSinceRestock
      products.push({
        ...p,
        stockHealth,
        drivers,
        healthHistory: buildHistory(stockHealth, trendClass),
      })
      skuNo++
    }
  }
  return products
}

export const products = generate()

// --- Инвариант шалгалтууд ---
console.assert(products.length === 75, 'products.length !== 75')
console.assert(
  products.every(
    (p) => 55 + p.drivers.reduce((a, d) => a + d.points, 0) === p.stockHealth,
  ),
  'drivers нийлбэр + 55 !== stockHealth',
)
console.assert(
  products.every(
    (p) =>
      p.healthHistory.length === 13 &&
      p.healthHistory[p.healthHistory.length - 1] === p.stockHealth,
  ),
  'healthHistory буруу (урт 13 биш эсвэл сүүлийнх нь оноотой тэнцэхгүй)',
)
