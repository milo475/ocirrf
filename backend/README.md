# ursGAL — backend

NestJS 11 + Prisma 7 + PostgreSQL 16. Систем бүхэлдээ юу хийдэг талаар
төслийн язгуур дахь [`../README.md`](../README.md) болон
[`../DEPLOY.md`](../DEPLOY.md)-ыг үзнэ үү. Энэ файл нь зөвхөн backend-ийн
өдөр тутмын командууд.

## Эхлүүлэх

```bash
npm ci
cp .env.example .env          # DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET
npx prisma migrate deploy
npx prisma generate           # client нь src/generated/prisma-д гарна
npx prisma db seed            # admin/manager/operator/driver + 10 бараа
npm run start:dev
```

API нь `http://localhost:3000/api` дээр. Production-д `frontend/dist`
мөн энэ портоор үйлчилдэг (ServeStatic).

## Командууд

| Команд | Тайлбар |
|---|---|
| `npm run start:dev` | Watch горим |
| `npm run build` / `npm run start:prod` | Production build/ажиллуулалт |
| `npm run test:e2e` | Бүрэн e2e багц (**бодит Postgres шаардана**) |
| `npm run lint` | ESLint --fix |
| `npm run format` | Prettier |
| `npx prisma studio` | DB-г хөтөчөөс үзэх |

## Тест

`test/api-v2.e2e-spec.ts` — бодит DB дээр ажиллаж, өөрийн үүсгэсэн
өгөгдлөө `afterAll`-д цэвэрлэдэг иж бүрэн багц (эрхийн матриц,
транзакцийн rollback, төлбөрийн уралдаан, SSE, CSV импорт, түгжилт,
refresh rotation, буцаалт). Дэлгэрэнгүйг [`../TESTING.md`](../TESTING.md).

`scripts/smoke-test.sh` — амьд сервер дээрх суурь шалгалт
(CI нь үүнийг docker compose дээр гүйцэтгэдэг).

## Бүтэц

- `src/permissions/permission-keys.ts` — **бүх эрхийн түлхүүр НЭГ Л ГАЗАР**
  (ROLE_DEFAULTS матриц энд). Шинэ endpoint нэмэхдээ `@RequirePermission`
  эсвэл `@Roles`-ыг ЗААВАЛ тавина — guard заагаагүй route-д оролцохгүй.
- `src/prisma/lock.util.ts` — мөнгө хөндөх транзакцуудын мөрийн түгжээ.
- `src/date-range.util.ts` — analytics/reports-ийн нэгдсэн `from`/`to`.
- 4 global guard дараалалтай: `JwtAuthGuard` → `PasswordChangeGuard` →
  `RolesGuard` → `PermissionsGuard`.
