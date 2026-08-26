# ursGAL

Дотоод дэлгүүрийн захиалга бүртгэл, агуулах, хүргэлт, санхүүгийн удирдлагын
систем. Нэг порт дээр NestJS API + React frontend хамт үйлчилнэ.

## Технологи

- **Backend:** NestJS 11, Prisma 7, PostgreSQL, JWT (access + refresh)
- **Frontend:** React 19, Vite, Tailwind v4, React Router 7
- **Тест:** Jest + supertest e2e (89 тест), bash smoke скриптүүд

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
npm run test:e2e                  # 89 тест, өөрийн ул мөрөө цэвэрлэдэг
bash scripts/smoke-test-v3.sh     # амьд сервэр дээрх v3 урсгалууд
bash scripts/smoke-test-v2.sh     # v2 урсгалууд
```

Гараар шалгах жагсаалт: [TESTING.md](TESTING.md).
Байршуулалт: [DEPLOY.md](DEPLOY.md).
