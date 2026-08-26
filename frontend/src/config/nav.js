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
  // ── CUSTOMER portal ──
  {
    key: 'portal-home',
    label: 'Миний самбар',
    icon: Home,
    path: '/portal',
    end: true,
    roles: ['CUSTOMER'],
  },
  {
    key: 'portal-new',
    label: 'Шинэ захиалга',
    icon: PlusCircle,
    path: '/portal/new',
    roles: ['CUSTOMER'],
  },
  {
    key: 'portal-orders',
    label: 'Миний захиалгууд',
    icon: PackageSearch,
    path: '/portal/orders',
    roles: ['CUSTOMER'],
  },
  {
    key: 'portal-profile',
    label: 'Профайл',
    icon: UserRound,
    path: '/portal/profile',
    roles: ['CUSTOMER'],
  },
  {
    key: 'portal-notifs',
    label: 'Мэдэгдэл',
    icon: Bell,
    path: '/notifications',
    roles: ['CUSTOMER'],
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
    path: '/users?role=DRIVER',
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
    perm: 'inventory.adjustment',
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
    anyPerm: ['finance.view_income', 'finance.view_expense'],
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
    label: 'Хэрэглэгчид',
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
