import {
  Bell,
  Boxes,
  ChartColumn,
  ClipboardList,
  Contact,
  FileSpreadsheet,
  Home,
  Map,
  Package,
  PackageSearch,
  PlusCircle,
  ScrollText,
  Truck,
  UserRound,
  Users,
  UsersRound,
  Wallet,
} from 'lucide-react'

/**
 * Sidebar-ын цэсийн нэгдсэн config (V3-17-ийн эцсийн бүтэц).
 * perm — effective permission; anyPerm — аль нэг нь байхад хангалттай;
 * roles — permission-гүй тухайлсан эрхийн цэс. Аль нь ч байхгүй бол
 * нэвтэрсэн бүгдэд. Дараалал = харагдах дараалал.
 */
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
    path: '/',
    end: true,
    roles: ['ADMIN', 'MANAGER', 'OPERATOR', 'DRIVER'],
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
    key: 'stock',
    label: 'Агуулах',
    icon: Boxes,
    path: '/stock',
    // Route нь inventory.view — цэс нь adjustment шаардаж байсан тул
    // зөвхөн харах эрхтэй хүнд цэс нуугдаад URL-ээр л ордог байв
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
    roles: ['ADMIN', 'MANAGER', 'OPERATOR'],
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
    key: 'activity',
    label: 'Үйлдлийн түүх',
    icon: ScrollText,
    path: '/activity-log',
    perm: 'activity_log.view',
  },
  // Тохиргоо sidebar-ын доод хэсэгт тогтмол байдаг (AppShell)
]

/** Хэрэглэгчид харагдах цэсүүд — permission эсвэл role-оор шүүнэ */
export function navFor(user, hasPerm) {
  if (!user) return []
  return NAV_ITEMS.filter((item) => {
    if (item.roles) return item.roles.includes(user.role)
    if (item.anyPerm) return item.anyPerm.some(hasPerm)
    if (item.perm) return hasPerm(item.perm)
    return true
  })
}
