import {
  Bell,
  Boxes,
  LayoutGrid,
  CalendarClock,
  ChartColumn,
  ClipboardList,
  Contact,
  FileSpreadsheet,
  Home,
  Map,
  Package,
  PackageSearch,
  PlusCircle,
  Repeat,
  ScrollText,
  Truck,
  UserRound,
  Users,
  UsersRound,
  Wallet,
  Inbox,
  PackageOpen,
} from 'lucide-react'

/**
 * Sidebar-ын цэсийн нэгдсэн config (V3-17-ийн эцсийн бүтэц).
 * perm — effective permission; anyPerm — аль нэг нь байхад хангалттай;
 * roles — permission-гүй тухайлсан эрхийн цэс. Аль нь ч байхгүй бол
 * нэвтэрсэн бүгдэд. Дараалал = харагдах дараалал.
 *
 * requires — эрхээс ГАДНА хуудасны урьдчилсан нөхцөл (V5). Цэс
 * харагдана гэдэг нь орж болно гэсэн амлалт; эрх байгаа ч тухайн
 * хуудас утга учиртай ажиллах нөхцөл бүрдээгүй бол харуулахгүй.
 */
/**
 * Цөм «Урсгал» app-ийн нүүр — хабын card, app switcher, nav-ийн «Нүүр»
 * энд заана; ursgal манифестийн basePath мөн энэ тогтмол. Нэвтэрсний
 * дараах нүүр нь ocirrf ХАБ (/launcher, RoleRoute.homeFor) — тэндээс
 * системээ сонгож энд орно.
 */
export const CORE_APP_HOME = '/dashboard'

export const NAV_ITEMS = [
  // ── DRIVER ──
  {
    key: 'deliveries',
    label: 'Миний хүргэлт',
    icon: Truck,
    path: '/deliveries',
    roles: ['DRIVER'],
  },
  // ── Staff нүүр ──
  {
    key: 'home',
    label: 'Нүүр',
    icon: Home,
    // '/' нь платформын нийтийн landing болсон (App Registry)
    path: CORE_APP_HOME,
    end: true,
    roles: ['ADMIN', 'MANAGER', 'OPERATOR', 'DRIVER', 'WAREHOUSE', 'SELLER'],
  },

  // ── Staff үндсэн цэсүүд (permission-оороо автоматаар) ──
  {
    key: 'orders',
    label: 'Захиалга',
    icon: ClipboardList,
    path: '/orders',
    end: true,
    perm: 'orders.view',
  },
  {
    key: 'order-requests',
    label: 'Хүсэлтүүд',
    icon: Inbox,
    path: '/order-requests',
    perm: 'orders.view',
  },
  {
    key: 'customers',
    label: 'Харилцагчид',
    icon: Contact,
    path: '/customers',
    perm: 'customers.view',
  },
  {
    key: 'drivers',
    label: 'Жолооч нар',
    icon: UsersRound,
    // Тусдаа хуудас — /users нь users.manage шаарддаг тул manager-т
    // drivers.view-ээрээ нээгддэг өөрийн route-тай
    path: '/drivers',
    perm: 'drivers.view',
  },
  {
    key: 'products',
    label: 'Бараа',
    icon: Package,
    path: '/products',
    perm: 'inventory.view',
  },
  {
    key: 'warehouse',
    label: 'Нярав',
    icon: PackageOpen,
    path: '/warehouse',
    perm: 'warehouse.handover',
  },
  {
    key: 'supplies',
    label: 'Нийлүүлэлт',
    icon: PackageSearch,
    path: '/supplies',
    perm: 'supplies.view',
    // Компанид холбогдоогүй харилцагчид харуулах зүйл байхгүй
    // (дотоод ажилтан companyId-гүй ч бүгдийг хардаг)
    requires: (user) => user.role !== 'OPERATOR' || Boolean(user.companyId),
  },
  {
    key: 'reorders',
    label: 'Дахин захиалга',
    icon: Repeat,
    path: '/reorders',
    perm: 'customers.view',
  },
  {
    key: 'stock',
    label: 'Агуулах',
    icon: Boxes,
    path: '/stock',
    // Route нь inventory.view — цэс нь adjustment шаардаж байсан тул
    // зөвхөн харах эрхтэй хүнд цэс нуугдаад URL-ээр л ордог байв
    perm: 'inventory.view',
  },
  {
    key: 'expiry',
    label: 'Хугацаа',
    icon: CalendarClock,
    path: '/expiry',
    perm: 'inventory.view',
  },
  {
    key: 'delivery-ops',
    label: 'Хүргэлтийн удирдлага',
    icon: Map,
    path: '/delivery-ops',
    perm: 'drivers.view',
  },
  {
    key: 'finance',
    label: 'Санхүү',
    icon: Wallet,
    path: '/finance',
    end: true,
    // Авлагын таб нь view_receivables-тэй тул түүнийг ганцаараа
    // эзэмшсэн хүн ч хуудсанд орох ёстой (route-той ижил жагсаалт)
    anyPerm: [
      'finance.view_income',
      'finance.view_expense',
      'finance.view_receivables',
    ],
  },
  {
    key: 'analytics',
    label: 'Аналитик',
    icon: ChartColumn,
    path: '/analytics',
    perm: 'analytics.view',
  },
  {
    key: 'reports',
    label: 'Тайлан',
    icon: FileSpreadsheet,
    path: '/reports',
    anyPerm: ['reports.delivery', 'reports.inventory', 'reports.finance'],
  },
  {
    key: 'notifications',
    label: 'Мэдэгдэл',
    icon: Bell,
    path: '/notifications',
    roles: ['ADMIN', 'MANAGER', 'OPERATOR', 'SELLER', 'WAREHOUSE'],
  },
  {
    key: 'users',
    label: 'User',
    icon: Users,
    path: '/users',
    end: true,
    perm: 'users.manage',
  },
  {
    key: 'apps',
    label: 'Апп-ууд',
    icon: LayoutGrid,
    path: '/settings/apps',
    end: true,
    // Endpoint-ийн permission-тэй ЯГ ижил (App Registry, Prompt 4)
    perm: 'platform.manage_apps',
  },
  {
    key: 'activity',
    label: 'Үйлдлийн түүх',
    icon: ScrollText,
    path: '/activity-log',
    perm: 'activity_log.view',
  },
  // Тохиргоо sidebar-ын доод хэсэгт тогтмол байдаг (AppShell)
]

/**
 * Утасны доод tab bar-т эрх бүрийн ХАМГИЙН ЧУХАЛ цэсүүд (V5).
 *
 * Sidebar-ын дараалал нь бүх эрхэд нэг ижил тул няравын доод барт
 * «Нүүр, Захиалга, Хүсэлтүүд, Харилцагчид» гарч, өөрийнх нь ажлын
 * хуудас цэсний ард нуугддаг байв. Эрх бүрт өөрийнх нь өдөр тутмын
 * зүйлийг эхэнд тавина; жагсаалтад байхгүй бол ердийн дараалал.
 */
const MOBILE_TABS = {
  ADMIN: ['home', 'orders', 'order-requests', 'finance'],
  MANAGER: ['home', 'orders', 'delivery-ops', 'finance'],
  SELLER: ['home', 'order-requests', 'orders', 'reorders'],
  WAREHOUSE: ['warehouse', 'orders', 'expiry', 'stock'],
  OPERATOR: ['home', 'orders', 'supplies', 'products'],
  DRIVER: ['deliveries', 'home'],
}

/**
 * Доод bar-т орох цэсүүд — MOBILE_TABS-ын дарааллаар, зөвхөн тухайн
 * хэрэглэгчид ХАРАГДДАГ нь. Дутвал ердийн дарааллаас нөхнө.
 */
export function mobileTabsFor(user, items, max = 4) {
  const wanted = MOBILE_TABS[user?.role] ?? []
  // ⚠ Энэ файл lucide-ээс `Map` icon-ыг импортолдог тул `new Map()`
  // бичвэл түүнийг дуудаж «not a constructor» гэж унана
  const picked = []
  for (const key of wanted) {
    const item = items.find((i) => i.key === key)
    if (item && !picked.includes(item)) picked.push(item)
    if (picked.length === max) break
  }
  for (const item of items) {
    if (picked.length === max) break
    if (!picked.includes(item)) picked.push(item)
  }
  return picked
}

/**
 * Хэрэглэгчид харагдах цэсүүд — permission эсвэл role-оор шүүнэ.
 * items — идэвхтэй app-ийн манифестийн navItems (өгөхгүй бол цөм ursgal).
 */
export function navFor(user, hasPerm, items = NAV_ITEMS) {
  if (!user) return []
  return items.filter((item) => {
    if (item.requires && !item.requires(user)) return false
    if (item.roles) return item.roles.includes(user.role)
    if (item.anyPerm) return item.anyPerm.some(hasPerm)
    if (item.perm) return hasPerm(item.perm)
    return true
  })
}
