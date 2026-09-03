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
1. `schema.prisma`-д `organizationId` + `organization` relation +
   **organizationId-ээр ЭХЭЛСЭН index** — жагсаалтын үндсэн эрэмбэтэй
   composite (`@@index([organizationId, createdAt])` маягаар); байгууллага
   доторх unique бол `@@unique([organizationId, X])` — энэ нь index-ийн
   үүргийг давхар гүйцэтгэдэг тул дан `@@index([organizationId])`
   давхардуулж нэмэхгүй
2. `org-scope.extension.ts`-ийн `SCOPED_MODELS`-д нэрийг нь нэмэх
3. create call site бүрт `organizationId: OrgContext.require()` тодоор өгөх
4. Raw SQL бичвэл `"organizationId" = ...` шүүлтийг ГАРААР нэмэх
   (extension нь $queryRaw-д үйлчилдэггүй)

`OrgContext.runBypassed` — зөвхөн auth bootstrap-д (login, refresh,
JwtStrategy, SSE token, uploads guard); шинэ хэрэглээ бүр аудит шаардана.

## Платформ ба App Registry

ocirrf нь Odoo маягийн ОЛОН системийн платформ: `/` нь нийтийн каталог
(landing), нэвтэрсний дараа шууд цөм app (`/dashboard`); `/launcher` нь
байгууллагын идэвхтэй app-уудын каталог (app switcher-ийн «Бүх апп»).
"Урсгал" (агуулах/захиалга/хүргэлт) нь эхний app. Каталог нь Application
хүснэгт (глобал), байгууллага бүрийн идэвхжүүлэлт нь OrganizationApp.

### Шинэ app нэмэх алхмууд (модулийн стандарт)

Дараагийн app (жишээ: Санхүү) хийхэд энэ дарааллаар:

1. **Application seed** — каталогт бүртгэнэ: migration-д тогтмол UUID-тай
   INSERT (+ seed.ts-ийн APP_CATALOG-д нэмэх) эсвэл SUPERADMIN консолоор.
   `key` нь тогтмол — production-д ороод ирвэл ХЭЗЭЭ Ч солигдохгүй.
   Эхлээд COMING_SOON — бэлэн болмогц консолоос ACTIVE болгоно.
2. **Permission key-үүд** — `src/permissions/permission-keys.ts`-д app-ийн
   эрхүүдийг нэмж PERM_LABELS, PERM_GROUPS, ROLE_DEFAULTS-д онооно.
   Хуучин key-үүдийн НЭРЭНД хүрэхгүй (тестийн тоололыг шинэчилнэ).
3. **Backend module** — `src/<key>/` NestJS module + controller + service;
   controller-ууд @RequirePermission-той.
4. **Prisma model-ууд** — org-scoped: дээрх Multi-tenancy checklist-ийг
   ЗААВАЛ дага (organizationId + relation + SCOPED_MODELS + create бүрт
   explicit orgId + байгууллага доторх unique бол composite +
   organizationId-ээр эхэлсэн composite index — масштабын дүрэм 4).
5. **Frontend манифест (LAZY)** — `frontend/src/apps/<key>/manifest.js` +
   `routes.jsx`. `key` нь Application.key-тэй ЯГ ижил. Манифест route
   модоо СТАТИКААР import хийхгүй — `loadRoutes`-оор lazy ачаална, ингэж
   app бүр өөрийн chunk (`assets/app-<key>-*.js`)-тэй болж зөвхөн тухайн
   app руу ороход татагдана:

   ```js
   // src/apps/<key>/manifest.js
   export const sankhuuManifest = {
     key: 'sankhuu',
     nameMn: 'Санхүү', icon: 'landmark', color: '#1e6091',
     basePath: '/sankhuu',           // app-ийн нүүр (switcher/launcher)
     mountPath: '/sankhuu/*',        // App.jsx энэ prefix дор угсарна
     loadRoutes: () => import('./routes'),   // ← lazy chunk-ийн entry
     navItems: SANKHUU_NAV,
     requiredPermissions: [],
   }

   // src/apps/<key>/routes.jsx — default export, ХАРЬЦАНГУЙ замууд
   export default function SankhuuRoutes() {
     return (
       <Routes>
         <Route index element={<SankhuuHome />} />          {/* /sankhuu */}
         <Route element={<PermRoute perm="sankhuu.view" />}>
           <Route path="accounts" element={<Accounts />} />  {/* /sankhuu/accounts */}
         </Route>
       </Routes>
     )
   }
   ```

   Дүрэм: (а) `routes.jsx`-ийг App.jsx/AppShell/launcher статикаар import
   хийхгүй (chunk үндсэн bundle-д нийлнэ); (б) хуудсууд өөрийн app-ийн
   `routes.jsx`-ээс л import хийгдэнэ; (в) `vite build`-ийн гаралтад
   `app-<key>-*.js` тусдаа харагдаж байгааг шалгана.
6. **Launcher/nav бүртгэл** — `frontend/src/apps/index.js`-ийн
   APP_MANIFESTS-д нэмнэ. App.jsx-д гар хүрэхгүй — бүрхүүл өөрөө угсарна.
7. **e2e тест** — app-ийн ажиллагаа + **cross-tenant тусгаарлалт ЗААВАЛ**
   (өөр байгууллагын өгөгдөл 404/харагдахгүй гэдгийг батлах,
   tenant-isolation.e2e-spec.ts-ийн загвараар).
8. **DEPLOY тэмдэглэл** — migration-тэй бол DEPLOY.md-ийн runbook-д
   дараалал, шалгалтыг нь бичнэ.

**Масштабын дүрмүүд (app бүрт заавал — дэлгэрэнгүй ARCHITECTURE.md §8):**

1. **PAGINATION ЗААВАЛ** — жагсаалт буцаадаг endpoint бүр эхнээсээ
   `page`/`limit` query (`@Type(() => Number) @IsInt @Min(1)`, `limit`
   `@Max(100)`, default 1/20) авч `{ items, total, page, limit }` буцаана
   (загвар: `QueryOrdersDto` + `OrdersService.findAll`). `take`-гүй
   `findMany` зөвхөн байгууллага дотроо хязгаартай reference жагсаалтад
   (ангилал, компани, ажилтан) тайлбартайгаар зөвшөөрөгдөнө.
2. **MODULE-ИЙН ХИЛ** — app бусад app-ийн дотоод service/файлыг шууд import
   хийхгүй; зөвхөн тухайн NestJS module-ийн `exports`-д зарласан public
   service/interface-ээр (module-ийг import хийж) харилцана. Бусад app-ийн
   Prisma model руу шууд бичихгүй. Frontend-д `src/apps/<өөр app>/…` import
   хийхгүй — хуваалцах зүйл `src/components`, `src/lib`, `src/context`-д.
3. **УДААН АЖИЛЛАГАА** — 3-5 секундээс удаан үргэлжилж болох үйлдэл (том
   export, олон мянган мөрийн тайлан, зураг боловсруулалт) синхрон endpoint
   дотор хийгдэхгүй: `// TODO(background-job)` гэж тэмдэглэж, 202 + job id
   загвараар тусдаа шийднэ (BullMQ + Redis ирээдүйд — одоо суулгахгүй).
4. **INDEX** — шинэ org-scoped model бүр organizationId-ээр эхэлсэн, үндсэн
   жагсаалтын эрэмбэтэй composite index-тэй (`prisma migrate diff`-ээр
   схем ба DB-ийн зөрүүг 0 болгож батална).
5. **SSE** — app өөрийн SSE суваг нээхгүй; мэдэгдэл платформын нэг сувгаар
   (`NotificationsService.notify*` → `/api/notifications/stream`) дамжина.

Дэлгэрэнгүй архитектур: [ARCHITECTURE.md](ARCHITECTURE.md)

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