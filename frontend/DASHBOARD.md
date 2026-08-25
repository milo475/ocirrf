# ursGAL — Нүүр хуудас (Нөөцийн эрүүл мэндийн самбар)

## Эх загвар (template brief)

Single-page "Customer health dashboard" — an editorial, data-dense view.
One route only (`/`), warm near-black dark theme (light toggle too), serif
headlines (Newsreader) over a mono/IBM Plex Mono data layer and Work Sans body.

Template layout (top to bottom, max-w-6xl, generous vertical rhythm):

1. **Header**: serif H1 with a small icon, right-aligned mono caption
   "N accounts / $Xk ARR", theme toggle.
2. **Stat row** — 4 equal columns divided by rules, large mono numbers,
   deltas turn alarm-red when they worsen.
3. **The chart** — a D3 beeswarm: every item is a circle, x = health score
   (10→100 linear), r = value (sqrt, ~3–18px), color = health only
   (neutral ink above 55 → vermilion alarm below 45 via oklch color-mix).
   Vertical risk-threshold line at 40. Combined / per-segment views,
   segment filter (dim others), floating tooltip, click → side panel.
4. **Watchlist** — top 8 by exposure = value×(1−h/100) + value×(drawdown/100)×1.4.
   Sparkline, drawdown, runway (linear slope fit of last 6 weeks → weeks to
   cross 40), WoW delta, alarm-red conditional cells.
5. **Side panel** — slide-in right drawer: driver waterfall (base 55 → ±drivers
   → final score), big sparkline, meta list.

d3-scale, d3-array, d3-force collision beeswarm, Tailwind v4 oklch tokens,
prefers-reduced-motion, staggered fade+translate entrances. No DB/auth —
demo data in one module.

## Домэйн хөрвүүлэлт

Гол асуулт: **аль бараа дуусах гэж байна, аль нь хэдэн төгрөгийн эрсдэлтэй вэ.**

| Загвар | ursGAL |
|---|---|
| Account | Product (бараа) |
| healthScore | stockHealth 0–100 |
| arr | monthlySales — сүүлийн 30 хоногийн борлуулалтын дүн |
| segment | category — Хүнс / Ундаа / Ахуй |
| owner | supplier — нийлүүлэгч |
| lastTouched | lastRestocked — сүүлд нөхөн дүүргэсэн |
| seatUtilization | turnoverRate — эргэц (0–1) |
| renewalDate | nextRestockDate |
| drivers[] | оноог бүрдүүлэгч хүчин зүйлс |
| healthHistory[] | 13 долоо хоногийн үлдэгдлийн бичлэг |

## stockHealth тооцох

Суурь 55, дараа нь driver бүр нэмэх/хасах:

| Driver | Утга | Оноо |
|---|---|---|
| Үлдэгдлийн хүрэлцээ | stockQty / reorderLevel | ≥2 → +25, 1–2 → +10, 0.5–1 → −10, <0.5 → −30 |
| Зарлагын хурд | сүүлийн 4 долоо хоногийн трэнд | буурч байгаа → +8, тогтвортой → 0, огцом өссөн → −15 |
| Нөхөн дүүргэлтийн хоцролт | lastRestocked-аас хойш хоног | <14 → +10, 14–30 → 0, >30 → −12 |
| Эргэц | turnoverRate | >0.7 → +12, 0.3–0.7 → +5, <0.3 → −8 (зогсонги нөөц) |

Эцсийн утгыг 0–100 хооронд clamp. Driver бүрийн оноо waterfall график дээр
харагдана. **Эрсдэлийн босго = 40** — түүнээс доош улаан.

---

# АЛХАМУУД

Дараалал чухал. Алхам бүр дуусахад "Батлах" хэсгийг баталгаажуулаагүй бол
дараагийн алхам руу орохгүй.

## Алхам 1 — Тема, фонт, токен

```bash
cd ~/ursGAL/frontend
npm install @fontsource/newsreader @fontsource/ibm-plex-mono @fontsource/work-sans
npm install -D tailwindcss @tailwindcss/vite
```

`src/index.css` дотор Tailwind v4 `@theme` блокоор oklch токен зарлана:

```css
@import "tailwindcss";
@import "@fontsource/newsreader/400.css";
@import "@fontsource/newsreader/500.css";
@import "@fontsource/ibm-plex-mono/400.css";
@import "@fontsource/work-sans/400.css";
@import "@fontsource/work-sans/500.css";

@theme {
  --font-serif: "Newsreader", serif;
  --font-mono: "IBM Plex Mono", monospace;
  --font-sans: "Work Sans", sans-serif;

  /* dark (үндсэн) — дулаан near-black */
  --color-bg:        oklch(0.16 0.008 60);
  --color-surface:   oklch(0.20 0.010 60);
  --color-ink:       oklch(0.92 0.012 70);
  --color-ink-muted: oklch(0.62 0.012 70);
  --color-rule:      oklch(0.30 0.010 60);
  --color-alarm:     oklch(0.62 0.19 32);   /* vermilion */
  --color-safe:      oklch(0.72 0.10 150);
}
```

Light тема `[data-theme="light"]` селектороор эдгээр хувьсагчийг дарж бичнэ.

**Батлах**: Хоосон хуудсан дээр 3 фонт зөв ачаалж, тема солих товч дарахад
өнгө солигдоно.

## Алхам 2 — Layout ба Header

Зөвхөн статик бүтэц. Өгөгдөл байхгүй, тоонууд түр хатуу бичээстэй.

- `max-w-6xl mx-auto px-6`
- Header: Package icon + serif H1 "Нөөцийн эрүүл мэнд"
- Баруун талд mono caption: `75 бараа / ₮48.2сая` + тема солих товч
- Босоо хэмнэл: хэсэг хоорондоо `mt-16`, дээд талд нь `border-t border-rule`

**Батлах**: Header гарч, тема солих ажиллана. Өөр юу ч байхгүй.

## Алхам 3 — Mock өгөгдөл

`src/mock/products.ts` — 75 бараа генерацлана. Гараар бичихгүй, функцээр үүсгэнэ.

```ts
export type StockDriver = { label: string; points: number };

export type ProductHealth = {
  id: string;
  sku: string;
  name: string;
  category: "Хүнс" | "Ундаа" | "Ахуй";
  monthlySales: number;
  stockQty: number;
  reorderLevel: number;
  stockHealth: number;          // 0-100
  supplier: string;
  lastRestocked: string;        // ISO
  nextRestockDate: string;      // ISO
  turnoverRate: number | null;  // 0-1
  drivers: StockDriver[];       // 55 + sum(points) === stockHealth
  healthHistory: number[];      // 13 утга, хамгийн хуучин нь эхэнд, сүүлийнх === stockHealth
};
```

Генератор дүрэм:

- Хүнс ~35, Ундаа ~22, Ахуй ~18 бараа
- monthlySales категориор өөр хүрээтэй (Хүнс их, Ахуй бага)
- healthHistory-г эхлээд random walk-оор үүсгэж, сүүлийн утгыг stockHealth болгоно
- Барааны ~20% нь буурах трэндтэй, ~15% нь огцом уналттай
- drivers-ийн нийлбэр + 55 = stockHealth яг таарах ёстой (үлдэгдлийг сүүлийн
  driver дээр тохируулна)

Файлын төгсгөлд `console.assert`-ээр эдгээр инвариантуудыг шалгана.

**Батлах**: `products.length === 75`, бүх бараанд drivers нийлбэр таарна,
`healthHistory.at(-1) === stockHealth`.

## Алхам 4 — Тооцооллын функцууд

`src/lib/metrics.ts` — цэвэр функцууд, UI-гүй.

```ts
drawdown(history)      // (max - current) / max * 100
wowDelta(history)      // сүүлийн 2 утгын зөрүү
runwayWeeks(history)   // сүүлийн 6 утганд шулуун ойролцоолж, 40 шугам огтлох хүртэл хэдэн долоо хоног
exposure(p)            // monthlySales*(1-h/100) + monthlySales*(drawdown/100)*1.4
daysSince(iso)
```

`runwayWeeks` — налуу эерэг эсвэл 0 бол `Infinity` буцаана.

**Батлах**: Мэддэг өгөгдөл дээр гараар тооцоод таарч байгааг шалга.
Жишээ: `[60,58,56,54,52,50]` → налуу −2/долоо хоног → 40 хүрэхэд 5 долоо хоног.

## Алхам 5 — Sparkline компонент

```bash
npm install d3-scale d3-array d3-shape d3-force
npm install -D @types/d3-scale @types/d3-array @types/d3-shape @types/d3-force
```

`src/components/Sparkline.tsx`:

- Props: `values: number[]`, `width=80`, `height=24`
- d3-scale `scaleLinear` хоёр (x: index, y: утга)
- d3-shape `line()`-ээр path
- Сүүлийн цэг дээр жижиг дугуй
- Трэнд буурч байвал alarm өнгө, эсрэг бол ink-muted

**Батлах**: 10 sparkline эгнүүлж гаргаж, хэлбэр нь өгөгдөлтэйгээ таарч
байгааг нүдээр шалга.

## Алхам 6 — Stat row

4 багана, хооронд нь босоо зураас (`divide-x divide-rule`).

| Карт | Утга | Delta |
|---|---|---|
| Эрсдэлд буй дүн | stockHealth < 50 барааны monthlySales нийлбэр | 4 долоо хоногийн өмнөхтэй % |
| Эрсдэлтэй бараа | тухайн барааны тоо | ялгаа |
| Дундаж оноо | медиан stockHealth | ялгаа |
| 30 хоногт нөхөх | nextRestockDate 30 хоногийн дотор — дүн + тоо | — |

Тоонууд `font-mono text-3xl`, гарчиг `text-xs uppercase tracking-wide
text-ink-muted`. Delta муудвал `text-alarm`, сайжирвал `text-safe`.

**Батлах**: 4 тоо гарна, mock өгөгдөл солиход тоо өөрчлөгдөнө.

## Алхам 7 — Beeswarm: зөвхөн масштаб (мөргөлдөөнгүй)

⚠️ Хоёр хэсэгт хуваасан нь санаатай — мөргөлдөөний логикийг нэг дор оруулбал
алдаа хаанаас гарсныг олохгүй.

Бүх дугуйг нэг шулуун дээр давхарлаж зурна:

- `xScale = scaleLinear().domain([10, 100]).range([0, width])`
- `rScale = scaleSqrt().domain([0, maxSales]).range([3, 18])`
- Өнгө: stockHealth. `> 55` → `--color-ink`, `< 45` → `--color-alarm`,
  хооронд нь `color-mix(in oklch, ...)` шилжилт
- x = 40 дээр босоо тасархай шугам, mono шошго "эрсдэлийн босго"

**Батлах**: 75 дугуй x тэнхлэг дээр зөв байрлана (оноо бага нь зүүн, улаан).
Давхарлаж байгаа нь хэвийн.

## Алхам 8 — Beeswarm: мөргөлдөөний layout

```ts
const nodes = products.map(p => ({ ...p, x: xScale(p.stockHealth), y: bandCenter }));

const sim = forceSimulation(nodes)
  .force("x", forceX(d => xScale(d.stockHealth)).strength(1))
  .force("y", forceY(bandCenter).strength(0.08))
  .force("collide", forceCollide(d => rScale(d.monthlySales) + 1).iterations(3))
  .stop();

for (let i = 0; i < 150; i++) sim.tick();
```

Чухал: `.stop()` дуудаж tick-ийг гараар эргүүлнэ. Үр дүнг `useMemo`-д хийнэ —
хамаарал: `[products, width, view, height]`.

**Батлах**: Дугуйнууд давхцахгүй, x байрлал оноогоо хадгална (±2px).

## Алхам 9 — Хоёр харагдац + шүүлтүүр + tooltip

- **ViewToggle**: Нэгтгэсэн / Категориор. Категориор: 3 зурвас, тус бүрд
  `Хүнс · 35 бараа · ₮18.4сая` mono caption. Зурвасын өндөр нь swarm-ийн
  бодит өндрөөр.
- **CategoryFilter**: нэг категори сонгоход бусад нь `opacity-20`. Дахин
  дарвал цуцлагдана.
- **Tooltip**: `pointer-events-none`, `position: fixed`, хулгана дагана.
  Дотор: нэр (serif), оноо · сарын борлуулалт · категори (mono).
- Дугуй дээр дархад бараа сонгогдож баруун самбар нээгдэнэ.

**Батлах**: Хоёр харагдац сэлгэнэ, шүүлтүүр ажиллана, tooltip дагана.

## Алхам 10 — Watchlist хүснэгт

exposure оноогоор дээд 8. Багана ба улаан болох нөхцөл:

| Багана | Улаан нөхцөл |
|---|---|
| Бараа (+категори) | — |
| Сарын борлуулалт | — |
| Оноо | < 40 |
| 13 долоо хоног (sparkline) | — |
| Уналт % | > 15 |
| Дуусах хугацаа | < 8 долоо хоног |
| Эргэц % | < 30 |
| 7 хоногийн өөрчлөлт | сөрөг |
| Сүүлд нөхсөн | > 30 хоног |
| Дараагийн нөхөлт | — |

Бүх тоо `font-mono tabular-nums`. Мөр дархад сонгогдоно.

**Батлах**: Хамгийн эрсдэлтэй нь дээр, улаан нүд зөв нөхцөлд асна.

## Алхам 11 — Барааны самбар (drawer)

Баруун талаас гулсах `w-[420px]` самбар:

- Гарчиг: нэр (serif) + SKU (mono)
- **Waterfall** — суурь 55 → driver бүр → эцсийн оноо. Нэмэх ногоон, хасах
  улаан. Тэнхлэг 0–100.
- 13 долоо хоногийн том sparkline (өргөн 380px)
- Мэдээлэл: нийлүүлэгч · үлдэгдэл/захиалгын түвшин · эргэц · сүүлд нөхсөн ·
  дараагийн нөхөлт
- Escape болон гадна дарахад хаагдана

**Батлах**: Waterfall-ийн эцсийн багана stockHealth-тэй яг таарна.

## Алхам 12 — Хөдөлгөөн ба нарийвчлал

- Хэсэг бүр `opacity-0 translate-y-4` → `opacity-100 translate-y-0`, 60ms зөрүүтэй
- `@media (prefers-reduced-motion: reduce)` — бүх transition duration-0
- Гар утсанд: stat row 2×2, beeswarm хэвтээ гүйлгэнэ, watchlist карт болно
- Keyboard: dot-ууд tabIndex-тэй, Enter → сонгогдоно

## Алхам 13 — Mock-оос бодит API руу

Backend endpoint: `GET /api/dashboard/stock-health` — `ProductHealth[]`-тэй
яг ижил хэлбэр. stockHealth, drivers, healthHistory-г StockMovement-ээс тооцно.

Frontend дээр солих зөвхөн нэг мөр — тиймээс **бүх компонент props-оор
өгөгдөл авна**, mock-ийг шууд import хийхгүй (Алхам 3-аас сахина).

---

## Анхаарах зүйлс (алдаа их гардаг 3 газар)

1. **drivers нийлбэр таарахгүй** — сүүлийн driver = `stockHealth - 55 - sum(бусад)`.
2. **Beeswarm өргөн 0** — ResizeObserver/useRef-ээр контейнерийн өргөн авахгүй
   бол эхний render дээр width=0. Өргөн ирээгүй бол зурахгүй хамгаалалт.
3. **Force simulation бүр render дээр** — useMemo-гүй бол гацна.

Дараалал: Алхам 7 → 8. Sparkline → beeswarm. Mock → компонент.
