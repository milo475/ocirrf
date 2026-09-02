# ocirrf

Олон байгууллагад зориулсан (multi-tenant) захиалга бүртгэл, агуулах,
хүргэлт, санхүүгийн удирдлагын систем. Байгууллага бүр /signup-аар
бүртгүүлж, тус тусын бүрэн тусгаарлагдсан өгөгдөлтэй ажиллана.
Нэг порт дээр NestJS API + React frontend хамт үйлчилнэ.

## Технологи

- **Backend:** NestJS 11, Prisma 7, PostgreSQL, JWT (access + refresh)
- **Frontend:** React 19, Vite, Tailwind v4, React Router 7
- **Тест:** Jest + supertest e2e (248 тест, tenant-isolation багтсан), bash smoke скриптүүд

## Олон байгууллага (Multi-tenancy)

Нэг deployment дээр олон байгууллага: хүснэгт бүр `organizationId`-тай,
`src/prisma/org-scope.extension.ts` нь query бүрт байгууллагын шүүлтийг
АВТОМАТААР нэмдэг (context байхгүй бол fail closed — алдаа шидэж унана).
Байгууллагыг `JwtStrategy` (нэвтэрсэн хэрэглэгч) эсвэл нийтийн захиалгын
token (`Organization.publicOrderToken`) тогтооно. Бүртгэл: `POST
/api/auth/register-org` буюу frontend-ийн `/signup`. Хуучин өгөгдөл
migration-аар default 'ocirrf' байгууллагад (UUID
`00000000-0000-4000-8000-000000000001`) харьяалагдсан.

**Шинэ model нэмэхдээ (checklist):**
1. `schema.prisma`-д `organizationId` + `organization` relation (+ index,
   байгууллага доторх unique бол `@@unique([organizationId, X])`)
2. `org-scope.extension.ts`-ийн `SCOPED_MODELS`-д нэрийг нь нэмэх
3. create call site бүрт `organizationId: OrgContext.require()` тодоор өгөх
4. Raw SQL бичвэл `"organizationId" = ...` шүүлтийг ГАРААР нэмэх
   (extension нь $queryRaw-д үйлчилдэггүй)

`OrgContext.runBypassed` — зөвхөн auth bootstrap-д (login, refresh,
JwtStrategy, SSE token, uploads guard); шинэ хэрэглээ бүр аудит шаардана.

## Платформ ба App Registry

ocirrf нь Odoo маягийн ОЛОН системийн платформ: `/` нь нийтийн каталог
(landing), нэвтэрсний дараа `/launcher` — байгууллагын идэвхтэй app-ууд.
"Урсгал" (агуулах/захиалга/хүргэлт) нь эхний app. Каталог нь Application
хүснэгт (глобал), байгууллага бүрийн идэвхжүүлэлт нь OrganizationApp.

### Шинэ app нэмэх алхмууд (модулийн стандарт)

1. **Application seed** — migration эсвэл SUPERADMIN консолоор каталогт
   бүртгэнэ: key (тогтмол, өөрчлөгдөхгүй!), нэр, icon, өнгө, статус.
2. **Frontend манифест** — `frontend/src/apps/<key>/manifest.js`:
   `{ key, nameMn, icon, color, basePath, routes, navItems,
   requiredPermissions }`. routes нь `<Route>` мод (`routes.jsx`),
   navItems нь nav.js-ийн хэв маягтай `{perm|anyPerm|roles|requires}`
   шүүлттэй жагсаалт.
3. **Бүртгэх** — `frontend/src/apps/index.js`-ийн APP_MANIFESTS-д нэмнэ.
   App.jsx-д гар хүрэхгүй: платформ бүрхүүл route/nav-аа өөрөө угсарна.
4. **Backend module** — NestJS module + Prisma model-ууд (org-scoped:
   дээрх Multi-tenancy checklist-ийг ЗААВАЛ дага).
5. **Permission key** — permission-keys.ts-д нэмж ROLE_DEFAULTS-д онооно
   (хуучин key-үүдийн нэрэнд хүрэхгүй).
6. **Тест** — e2e (cross-tenant тусгаарлалтын тест ЗААВАЛ).

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
# 1. PostgreSQL: ocirrf DB + ocirrf_user (DEPLOY.md §2)
cd backend
cp .env.example .env && npm ci
npx prisma migrate deploy && npx prisma generate && npx prisma db seed
npm run build

cd ../frontend
npm ci && npm run build

cd ../backend
node dist/main        # http://localhost:3000
```

Нэвтрэх (seed): `admin@ocirrf.mn/admin123`, `manager@ocirrf.mn/manager123`,
`operator@ocirrf.mn/operator123`, `driver@ocirrf.mn/driver123`.
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
 


 duureg songolt 6n duureg oruulah bgd bzd hud sbd chd shd 
 horoo songoh duuregt bdg songoltuud hud ghd 25n horootoi bol ter 25 aas songolt hiideg bh 
 door ni songoson baraanii list une haragdd etsest ni negdsen dun haragdah ystoi tgd tolbor tologdsn bolon tologdoogui gsn 2 songolt ogno songood tologsn bol shuud zahialgaa batalgaajuulj bolno tologdoogui bol hediig avah gsn too bichih songolt ogno tolbor avah tgd shuud zahialgaa uusgeh gej orno 

 hariltsagc deer company nii ner oruulj ogoh buyu hamtarch bga gazruudin list bn dtroo heden operator burtgeltei bgg hardag 

 ter door hereglegchid gedeg neriig ni soliod User bolgo tend hols gesen hesgiig has nemelt company nii songolt oruulj ir ali company nii operator holbootoi bn gedgiig 

 jolooch heseg der niit hurgesen hurgeltiin too bolon ter hugatsaand ajillasan hurgeltuudiin niit DR% ajliin torol gej mon nemj oruulaad unsen esvel tsagiin gsn songolt oruul tgd bus gej oruulaad hariyaalagdah busiig ni songodog bolgo 
  nyrav heseg nemeh manager jolooch nart huvaarilaad daraa ni nyravt huvaarilana nyravt haragdah ym ni blhr tuhain joloochid her ih baraa ochih ve tgd zahialgiin huudsaar heveldeg heseg nemeh zahialgiin huudas dotr hednii odor ymr joloochid ymr2 baraa huleelgej ogsn be gdg list heregtei mon 2 taliin batalgaajuulsn gariin useg zurdag heseg bh  nyrav aas mon tolov oorchildog heseg bh beltgej bh uyiin process iig oruulj ogdog bvl sn 

  bara heseg deeress ortog bolon ashig gsn hesgiig ustgah limit gesniig soliod low stock alert bolgo hailt heseg nemeed hariltsagc companiar harj boldog bolgoh 

  zahialgiin heseg deer duurgeer filter hiij boldog bh manager jolooch huvaariladag heseg mon nyrav huvaariladag heseg nemeh ali aliig ni olnoor checkelj bgd zereg huvaarilj boldog bolgoh 