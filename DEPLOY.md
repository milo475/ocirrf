# ocirrf — Production байршуулалт

Нэг серверт NestJS нь API + frontend-ийн статик файлыг хамт үйлчилнэ
(нэг порт, default 3000).

## 1. Урьдчилсан нөхцөл

- Node.js 20+ (LTS), PostgreSQL 14+
- PM2: `npm install -g pm2`

## 2. Анхны тохиргоо

```bash
git clone git@github.com:milo475/ocirrf.git && cd ocirrf

# DB + хэрэглэгч (postgres superuser-ээр):
#   CREATE DATABASE ocirrf;
#   CREATE USER ocirrf_user WITH PASSWORD '<хүчтэй нууц үг>' CREATEDB;
#   GRANT ALL PRIVILEGES ON DATABASE ocirrf TO ocirrf_user;
#   \c ocirrf
#   GRANT ALL ON SCHEMA public TO ocirrf_user;

cd backend
cp .env.example .env       # бөглөнө: DB нууц үг, openssl rand -hex 32 × 2
npm ci
npx prisma migrate deploy  # migration-уудыг ажиллуулна (dev биш!)
npx prisma generate
npx prisma db seed         # эхний админ + жишээ өгөгдөл (нэг л удаа)

cd ../frontend
npm ci
npm run build              # → frontend/dist (backend үүнийг serve хийнэ)

cd ../backend
npm run build              # → backend/dist
```

⚠ Seed-ийн дараа admin@ocirrf.mn / operator@ocirrf.mn нууц үгсийг
UI-ийн Хэрэглэгчид хуудаснаас шууд соль.

## 3. Ажиллуулах

```bash
cd backend
pm2 start ecosystem.config.js
pm2 save && pm2 startup    # reboot-д автоматаар асна
```

Шалгах: `curl localhost:3000/api/health` → `{"status":"ok","db":true}`,
браузераар `http://<сервер>:3000` → login хуудас.

Гаднаас 80/443-аар үйлчлэх бол nginx reverse proxy + certbot SSL-ийг
3000 порт руу чиглүүлнэ.

## 4. Шинэ хувилбар гаргах

```bash
cd ocirrf && git pull
cd frontend && npm ci && npm run build
cd ../backend && npm ci && npx prisma migrate deploy && npm run build
pm2 restart ocirrf-api
```

### Индексийн migration (`*_org_scoped_indexes`, 2026-09-03)

Зөвхөн `CREATE INDEX` / давхардсан `DROP INDEX` — өгөгдөл, багана
хөндөгдөхгүй. `migrate deploy` энгийн `CREATE INDEX` ажиллуулдаг тул хүснэгт
бүр индекс үүсэх хугацаанд бичилтэд түр түгжигдэнэ (олон мянган мөртэй
хүснэгтэд секундын дотор). Ачаалал багатай цагт ажиллуулна; rollback
шаардлагатай бол тухайн `DROP INDEX`-ийг гараар ажиллуулахад хангалттай.

### Multi-tenancy migration (20260902120000, нэг удаагийн big-bang)

Хуучин (нэг байгууллагын) хувилбараас шинэчлэхэд энэ migration нь шинэ
кодтой ХАМТ атомоор орох ёстой — хуучин код шинэ схемтэй (Setting-ийн PK
өөрчлөгдсөн), шинэ код хуучин схемтэй ажиллахгүй:

```bash
pm2 stop ocirrf-api
npx prisma migrate deploy    # бүх өгөгдөл default 'ocirrf' байгууллагад орно
npm run build                # шинэ dist
pm2 start ocirrf-api
```

Богино зогсолт гарна (PM2 instances:1 тул асуудалгүй). Migration нь
одоогийн өгөгдлийг default байгууллагад backfill хийдэг тул өгөгдөл
алдагдахгүй; хуучин нийтийн захиалгын линк (/z/:token) хэвээр ажиллана.

### Платформ бүрхүүлийн migration-ууд (App Registry + SUPERADMIN)

Multitenancy-ийн ДАРАА энэ дарааллаар (prisma migrate deploy автоматаар
зөв дарааллыг барина):

1. `20260902120000_multitenancy` — big-bang (дээрх runbook)
   (…)
   `20260904000000_app_studexa` — Studexa (app 11): 13 шинэ `Studexa*`
   хүснэгт + 5 enum + каталогт `studexa` ACTIVE INSERT + default
   байгууллагад идэвхжүүлэлт. Хуучин хүснэгтэд хүрэхгүй, ердийн
   `prisma migrate deploy`-оор суудаг; `UPLOADS_DIR`-д `sx-*` файлууд нэмэгдэнэ.
2. `20260902180000_app_registry` — Application + OrganizationApp,
   каталогийн 6 app seed, бүх байгууллагад ursgal идэвхжинэ. Хуучин
   кодтой зэрэгцэн ажиллаж БОЛНО (шинэ хүснэгтүүд л нэмэгддэг).
3. `20260902200000_superadmin` — User.isSuperAdmin (default false).
   Мөн хуучин кодтой нийцтэй.

Тиймээс 2, 3-т зогсолт шаардлагагүй — энгийн release урсгалаар л явна.

**Дараах шалгалтууд** (release бүрийн дараа):

```bash
curl -s localhost:3000/api/health                # {"status":"ok","db":true}
curl -s localhost:3000/api/platform/apps | head  # каталог 6 app
npm run test:e2e                                 # бүх тест ногоон
```

**SUPERADMIN олгох** (нэг удаа, deploy-ийн дараа):

```bash
docker compose exec app npx tsx scripts/make-superadmin.ts <email>
# эсвэл PM2 орчинд: cd backend && npx tsx scripts/make-superadmin.ts <email>
```

## 5. Backup

Өдөр тутмын DB dump + uploads/ зургийн архив (14 хоног хадгална):

```bash
bash backend/scripts/backup-db.sh
```

Cron-д суулгах: `crontab -e` →

```
0 3 * * * bash /home/kali/ocirrf/backend/scripts/backup-db.sh >> $HOME/ocirrf-backups/backup.log 2>&1
```

Сэргээх: `gunzip -c ocirrf-YYYYMMDD-HHMMSS.sql.gz | psql "$DATABASE_URL"`

## 6. Production-д солих утгууд (жагсаалт)

| Хувьсагч | Хаана | Юу хийх |
|---|---|---|
| DATABASE_URL нууц үг | backend/.env | Хүчтэй нууц үг, шаардлагатай бол sslmode=require |
| JWT_SECRET | backend/.env | `openssl rand -hex 32` шинээр |
| JWT_REFRESH_SECRET | backend/.env | `openssl rand -hex 32` шинээр (өөр утга) |
| PORT | backend/.env | Шаардлагатай бол |
| UPLOADS_DIR | backend/.env | Баталгаажуулах зургууд кодоос гадуур (ж: /var/lib/ocirrf/uploads) |
| CORS_ORIGIN | backend/.env | Зөвхөн frontend тусдаа домэйнд байвал |
| Seed нууц үгс | UI | admin/manager/operator/driver 4 хэрэглэгчийн нууц үгийг солих |

## 7. v3 модулиуд (2026-08 өргөтгөл)

v3-д нэмэгдсэн зүйлс байршуулалтад нэмэлт тохиргоо шаарддаггүй —
бүгд `prisma migrate deploy`-оор автоматаар суудаг. Товч бүтэц:

| Модуль | Юу хийдэг | Хамгаалалт |
|---|---|---|
| permissions | Role default + хэрэглэгч тус бүрийн override (Permission Panel: /users/:id/permissions) | permissions.manage |
| finance | Орлого/зарлагын гүйлгээ, DELIVERED болмогц авто орлого, жолоочийн цалингийн тооцоо (payroll) | finance.* |
| notifications | Хонхны мэдэгдэл (хуваарилалт, бага үлдэгдэл, амжилтгүй хүргэлт, онлайн захиалга, статус) | өөрийн л |
| activity-log | Бүх амжилттай POST/PATCH/PUT/DELETE-ийн түүх (interceptor) | activity_log.view |
| delivery-ops | Хүргэлтийн самбар + жолоочийн маршрутын дараалал (routeOrder, mapUrl) | orders.view+drivers.view |
| customers | Бүртгэлтэй + утасны захиалгаас бүлэглэсэн харилцагчид | customers.* |
| settings | companyName, companyPhone, банкны данс — DB-д (Setting хүснэгт), UI: /settings | settings.edit |
| analytics | Борлуулалт/TOP бараа/жолооч/харилцагчийн аналитик | analytics.view |
| reports | CSV тайлан (UTF-8 BOM — Excel-д кирилл зөв) | reports.* |

Тэмдэглэл:

- **Эрх 6 болсон**: ADMIN, MANAGER, OPERATOR, DRIVER, WAREHOUSE, SELLER.
  (CUSTOMER нь `20260829120000_remove_portal_and_tariffs`-аар хасагдсан.)
  Effective permission = хэрэглэгчийн override ?? role default
  (`backend/src/permissions/permission-keys.ts` — нэг л эх сурвалж).
  ADMIN-ий эрхийг хэн ч хасаж чадахгүй.
- **companyName, банкны данс** зэрэг тохиргоо .env биш DB-ийн Setting
  хүснэгтэд — UI-ийн /settings хуудаснаас удирдана.
- Smoke: `bash backend/scripts/smoke-test.sh`.

## 8. Жолоочийн PWA (V4-10)

Систем PWA тул жолооч утсандаа app шиг суулгаж болно:

**Android (Chrome):**
1. Chrome-оор системийн хаягаа нээж жолоочоор нэвтэрнэ.
2. Баруун дээд ⋮ цэс → **"Add to Home screen" / "Нүүр дэлгэцэд нэмэх"**.
3. Нэрийг баталгаажуулаад **Add** — нүүр дэлгэц дээр ocirrf icon үүснэ.
4. Icon-оос нээхэд бүтэн дэлгэцээр (standalone) ажиллана.

**iPhone (Safari):** Share товч → **"Add to Home Screen"**.

Offline горим:
- Сүлжээгүй үед app нээгдэж, хүргэлтийн жагсаалтын сүүлчийн
  амжилттай хуулбар харагдана (топбарт улаан "Офлайн" индикатор).
- Хүргэлт баталгаажуулбал зурагтайгаа төхөөрөмжид (IndexedDB)
  хадгалагдаж, сүлжээ сэргэмэгц автоматаар илгээгдэнэ —
  "Миний хүргэлт" дээр хүлээгдэж буй тоо харагдана.

## 9. Алдааны лог (V4-14)

- Catch болоогүй бүх 500 алдаа `backend/logs/error-YYYY-MM-DD.log`
  файлд JSON мөрөөр бичигдэнэ (timestamp, path, method, userId,
  message, stack). 14 хоногоос хуучин файл автоматаар устдаг.
  Байршлыг `LOGS_DIR` env-ээр өөрчилж болно.
- UI: `/activity-log` → "Системийн алдаа" таб (activity_log.view эрхтэйд).
- Cron шалгалт:

```bash
# Өглөө бүр 09:00-д өнөөдрийн алдааны тоог шалгана
0 9 * * * bash /path/to/ocirrf/backend/scripts/check-errors.sh >> /var/log/ocirrf-errors.log 2>&1
```

## 10. Docker-оор байршуулах (V4-15)

Нэг командаар бүх зүйл (Postgres + app) асна:

```bash
cp .env.example .env        # JWT нууцуудаа заавал солино (openssl rand -hex 32)
docker compose up -d        # build → migrate → (эхний удаа) seed → сервер
```

- `db` — postgres:16, өгөгдөл `dbdata` volume-д хадгалагдана.
- `app` — backend/Dockerfile (multi-stage: backend + frontend build →
  node:20-slim runtime). Эхлэхдээ `prisma migrate deploy` ажиллуулж,
  User хүснэгт ХООСОН үед л seed хийнэ (дараагийн restart бодит
  өгөгдлийг дарахгүй). Зураг `uploads`, алдааны лог `logs` volume-д.
- Health: `curl http://localhost:3000/api/health` → `{"status":"ok","db":true}`.
- Шинэ хувилбар: `git pull && docker compose up -d --build`.
- Зогсоох: `docker compose down` (өгөгдөл үлдэнэ);
  `down -v` — volume-уудтай нь БҮРЭН устгана (болгоомжтой!).
- Smoke: `bash backend/scripts/smoke-test.sh` (host дээрээс).

CI-ийн "Docker compose (smoke)" job push бүрт яг энэ урсгалыг цэвэр
орчинд бүрэн ажиллуулж баталдаг.

## 11. v4 модулиуд (2026-08 өргөтгөл)

| Модуль | Гол зүйл |
|---|---|
| finance/payments | ОРЛОГО = ТӨЛБӨР: POST /orders/:id/payments, авлага GET /finance/receivables |
| orders/returns | POST /orders/:id/return — restock/refund/payroll хасалт нэг transaction-д |
| auth хамгаалалт | reset-password (түр нууц үг), rate limit, түгжилт + unlock, refresh rotation, logout revoke |
| notifications/sse | GET /notifications/stream (token query) — real-time push |
| products/import | GET import-template.csv, POST /products/import, barcode unique |
| logging | logs/error-YYYY-MM-DD.log + GET /admin/errors + scripts/check-errors.sh |
| CI/Docker | .github/workflows/ci.yml (e2e + docker smoke), docker compose up -d |

Smoke: `bash backend/scripts/smoke-test.sh`.


## Цагийн бүс (TZ)

Систем өдрийн хил (`setHours(0,0,0,0)`), захиалга/хуудасны дугаарын огноо
(`ORD-YYYYMMDD`), тайлангийн огнооны муж (`parseDateRange`)-ийг **серверийн
локал цагаар** тооцдог. `backend/src/main.ts` `TZ` тавиагүй бол
`Asia/Ulaanbaatar` болгоно; Dockerfile, docker-compose (`TZ=${TZ:-Asia/Ulaanbaatar}`),
ecosystem.config.js мөн ижил default-тай. Өөр цагийн бүсэд ажиллуулах бол
`.env`-д `TZ=` тавина. (Studexa app нь өдрөө `Asia/Ulaanbaatar`-аар тодорхой
тооцдог тул TZ-ээс хамаарахгүй.)
