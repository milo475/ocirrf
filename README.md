# ursGAL

[![CI](https://github.com/milo475/ursGAL/actions/workflows/ci.yml/badge.svg)](https://github.com/milo475/ursGAL/actions/workflows/ci.yml)

Дотоод дэлгүүрийн захиалга бүртгэл, агуулах, хүргэлт, санхүүгийн удирдлагын
систем. Нэг порт дээр NestJS API + React frontend хамт үйлчилнэ.

## Технологи

- **Backend:** NestJS 11, Prisma 7, PostgreSQL, JWT (access + refresh)
- **Frontend:** React 19, Vite, Tailwind v4, React Router 7
- **Тест:** Jest + supertest e2e (120 тест) + GitHub Actions CI, bash smoke скриптүүд

## Эрхийн систем (5 эрх)

| Эрх | Хэн | Гол чадвар |
|---|---|---|
| ADMIN | Систем админ | Бүх зүйл (эрх нь хасагдахгүй) |
| MANAGER | Агуулахын менежер | Бараа/агуулах, хуваарилалт, санхүү, цалин, аналитик |
| OPERATOR | Захиалга хүлээн авагч | Захиалга шивэх, өөрийн захиалгын статус |
| DRIVER | Жолооч | Өөрийн хүргэлт, зурагтай баталгаажуулалт, цалингийн задаргаа |
| CUSTOMER | Онлайн харилцагч | Бүртгүүлж захиалах, tracking, нэхэмжлэх |

Permission = код доторх role default матриц
([permission-keys.ts](backend/src/permissions/permission-keys.ts)) +
хэрэглэгч тус бүрийн DB override (Permission Panel:
Хэрэглэгчид → Эрхүүд). Effective = override ?? default.

## Гол урсгалууд

- **Захиалга**: 2 алхамт wizard (УБ/Орон нутгийн бүтэцлэгдсэн хаяг) →
  transaction-аар үлдэгдэл хасагдана → статусын мөчлөг
  (Шинэ→Баталгаажсан→Бэлтгэж буй→Бэлэн→Дууссан / Цуцлагдсан).
- **Хүргэлт**: жолооч хуваарилах ("Тээвэрт гаргах" — орон нутагт),
  маршрутын дараалал, зурагтай баталгаажуулалт, ops самбар.
- **Санхүү**: хүргэгдмэгц авто орлого, гар гүйлгээ, жолоочийн цалингийн
  тооцоо (payroll close → PAID).
- **Portal**: харилцагч өөрөө бүртгүүлж захиалаад явцаа хянана
  (progress зураас, proof зураг, хэвлэх нэхэмжлэх).
- **Мэдэгдэл + Үйлдлийн түүх**: хонх (30с refresh), бүх өөрчлөлтийн лог.
- **Аналитик + Тайлан**: борлуулалт/TOP бараа/жолооч/харилцагч;
  UTF-8 BOM CSV (Excel-д кирилл зөв).

## Ажиллуулах (dev)

```bash
# 1. PostgreSQL: ursgal DB + ursgal_user (DEPLOY.md §2)
cd backend
cp .env.example .env && npm ci
npx prisma migrate deploy && npx prisma generate && npx prisma db seed
npm run build

cd ../frontend
npm ci && npm run build

cd ../backend
node dist/main        # http://localhost:3000
```

Нэвтрэх (seed): `admin@ursgal.mn/admin123`, `manager@ursgal.mn/manager123`,
`operator@ursgal.mn/operator123`, `driver@ursgal.mn/driver123`.
Харилцагч: /register хуудаснаас өөрөө бүртгүүлнэ.

## Тест

```bash
cd backend
npm run test:e2e                  # 120 тест, өөрийн ул мөрөө цэвэрлэдэг
bash scripts/smoke-test-v4.sh     # v4: төлбөр/буцаалт/тариф/түгжилт/SSE/импорт
bash scripts/smoke-test-v3.sh     # амьд сервэр дээрх v3 урсгалууд
bash scripts/smoke-test-v2.sh     # v2 урсгалууд
```

Гараар шалгах жагсаалт: [TESTING.md](TESTING.md).
Байршуулалт: [DEPLOY.md](DEPLOY.md).

## v4 модулиуд (2026-08 өргөтгөл)

| Хэсэг | Тайлбар | Хамгаалалт |
|---|---|---|
| payments | Төлбөр бүртгэл (бэлэн/шилжүүлэг/карт), **ОРЛОГО = ТӨЛБӨР** (хүргэлт биш), авлагын жагсаалт | finance.* |
| returns | Хэсэгчилсэн/бүтэн буцаалт: үлдэгдэл сэргээх, төлбөр буцаах (REFUND зарлага), жолоочийн цалингаас хасах | orders.refund |
| cost/profit | Барааны өртөг + захиалгын мөрийн snapshot → ашиг аналитик/dashboard-д | inventory.adjustment (өртөг нуугдана) |
| tariffs | Хүргэлтийн тариф (бүс + УБ дүүрэг тусгайлан), захиалгад автомат, staff override | settings.edit |
| security | Түр нууц үг + заавал солих урсгал, rate limit (5/мин), 5 буруу → 15 мин түгжээ, refresh token rotation + гэр бүлийн revoke | users.manage |
| sse | Real-time мэдэгдэл (EventSource) — badge секундын дотор, 30с poll fallback | өөрийн л |
| pwa | Жолоочийн суулгаж болох app + offline баталгаажуулалтын дараалал (IndexedDB) | — |
| picking | Бэлтгэх хуудас: сонгосон захиалгуудын нэгтгэсэн бараа + захиалга тус бүр, хэвлээд PREPARING | orders.view |
| import | Бараа CSV импорт (SKU-гаар upsert, INITIAL үлдэгдэл) + barcode хайлт/камер скан | inventory.adjustment |
| logging | 5xx алдааны файл лог (14 хоног), admin UI таб, cron скрипт | activity_log.view |
| ci/docker | GitHub Actions (e2e + docker smoke), docker compose нэг командын байршуулалт | — |

### Захиалгын мөнгөн урсгалын зураглал (v4)

```
Захиалга ──► CONFIRMED ──► PREPARING ──► READY ──► COMPLETED
   │           (бэлтгэх хуудас)     (хүргэлт: ASSIGNED → DELIVERED)
   │  нийт дүн = бараа + хүргэлтийн тариф (автомат/override)
   ▼
Төлбөр бүртгэл ──► ОРЛОГО (PAYMENT) ──► UNPAID → PARTIAL → PAID
   │                                    (дутуу бол Авлага тайланд)
   ▼
Буцаалт ──► үлдэгдэл сэргэнэ (RETURN) + төлбөр буцна (REFUND зарлага)
            + шаардлагатай бол жолоочийн цалингийн тооцооноос хасна
```
