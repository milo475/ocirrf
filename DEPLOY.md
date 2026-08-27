# ursGAL — Production байршуулалт

Нэг серверт NestJS нь API + frontend-ийн статик файлыг хамт үйлчилнэ
(нэг порт, default 3000).

## 1. Урьдчилсан нөхцөл

- Node.js 20+ (LTS), PostgreSQL 14+
- PM2: `npm install -g pm2`

## 2. Анхны тохиргоо

```bash
git clone git@github.com:milo475/ursGAL.git && cd ursGAL

# DB + хэрэглэгч (postgres superuser-ээр):
#   CREATE DATABASE ursgal;
#   CREATE USER ursgal_user WITH PASSWORD '<хүчтэй нууц үг>' CREATEDB;
#   GRANT ALL PRIVILEGES ON DATABASE ursgal TO ursgal_user;
#   \c ursgal
#   GRANT ALL ON SCHEMA public TO ursgal_user;

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

⚠ Seed-ийн дараа admin@ursgal.mn / operator@ursgal.mn нууц үгсийг
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
cd ursGAL && git pull
cd frontend && npm ci && npm run build
cd ../backend && npm ci && npx prisma migrate deploy && npm run build
pm2 restart ursgal-api
```

## 5. Backup

Өдөр тутмын DB dump + uploads/ зургийн архив (14 хоног хадгална):

```bash
bash backend/scripts/backup-db.sh
```

Cron-д суулгах: `crontab -e` →

```
0 3 * * * bash /home/kali/ursGAL/backend/scripts/backup-db.sh >> $HOME/ursgal-backups/backup.log 2>&1
```

Сэргээх: `gunzip -c ursgal-YYYYMMDD-HHMMSS.sql.gz | psql "$DATABASE_URL"`

## 6. Production-д солих утгууд (жагсаалт)

| Хувьсагч | Хаана | Юу хийх |
|---|---|---|
| DATABASE_URL нууц үг | backend/.env | Хүчтэй нууц үг, шаардлагатай бол sslmode=require |
| JWT_SECRET | backend/.env | `openssl rand -hex 32` шинээр |
| JWT_REFRESH_SECRET | backend/.env | `openssl rand -hex 32` шинээр (өөр утга) |
| PORT | backend/.env | Шаардлагатай бол |
| UPLOADS_DIR | backend/.env | Баталгаажуулах зургууд кодоос гадуур (ж: /var/lib/ursgal/uploads) |
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
| portal | CUSTOMER бүртгэл (/api/auth/register), өөрийн захиалга/tracking/нэхэмжлэх, цуцлалт | role CUSTOMER |
| customers | Бүртгэлтэй + утасны захиалгаас бүлэглэсэн харилцагчид | customers.* |
| settings | companyName, companyPhone, allowCustomerCancel — DB-д (Setting хүснэгт), UI: /settings | settings.edit |
| analytics | Борлуулалт/TOP бараа/жолооч/харилцагчийн аналитик | analytics.view |
| reports | CSV тайлан (UTF-8 BOM — Excel-д кирилл зөв) | reports.* |

Тэмдэглэл:

- **Эрх 5 болсон**: ADMIN, MANAGER, OPERATOR, DRIVER, CUSTOMER.
  Effective permission = хэрэглэгчийн override ?? role default
  (`backend/src/permissions/permission-keys.ts` — нэг л эх сурвалж).
  ADMIN-ий эрхийг хэн ч хасаж чадахгүй.
- **allowCustomerCancel** зэрэг тохиргоо .env биш DB-ийн Setting
  хүснэгтэд — UI-ийн /settings хуудаснаас удирдана.
- Smoke: `bash backend/scripts/smoke-test-v3.sh` (v1: smoke-test.sh,
  v2: smoke-test-v2.sh).

## 8. Жолоочийн PWA (V4-10)

Систем PWA тул жолооч утсандаа app шиг суулгаж болно:

**Android (Chrome):**
1. Chrome-оор системийн хаягаа нээж жолоочоор нэвтэрнэ.
2. Баруун дээд ⋮ цэс → **"Add to Home screen" / "Нүүр дэлгэцэд нэмэх"**.
3. Нэрийг баталгаажуулаад **Add** — нүүр дэлгэц дээр ursGAL icon үүснэ.
4. Icon-оос нээхэд бүтэн дэлгэцээр (standalone) ажиллана.

**iPhone (Safari):** Share товч → **"Add to Home Screen"**.

Offline горим:
- Сүлжээгүй үед app нээгдэж, хүргэлтийн жагсаалтын сүүлчийн
  амжилттай хуулбар харагдана (топбарт улаан "Офлайн" индикатор).
- Хүргэлт баталгаажуулбал зурагтайгаа төхөөрөмжид (IndexedDB)
  хадгалагдаж, сүлжээ сэргэмэгц автоматаар илгээгдэнэ —
  "Миний хүргэлт" дээр хүлээгдэж буй тоо харагдана.
