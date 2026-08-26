import {
  Bell,
  Boxes,
  ClipboardList,
  HandCoins,
  Home,
  Map,
  Package,
  PackageSearch,
  PlusCircle,
  ScrollText,
  Truck,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react'

/**
 * Sidebar-ын цэсийн нэгдсэн config.
 * perm  — effective permission түлхүүр (байвал hasPerm-ээр шүүгдэнэ)
 * roles — permission-гүй, тухайлсан эрхийн цэс (жолоочийн Миний хүргэлт)
 * Аль нь ч байхгүй бол нэвтэрсэн бүх хэрэглэгчид харагдана.
 * Дараалал чухал: DRIVER-т "Миний хүргэлт" хамгийн эхэнд гарна.
 */
export const NAV_ITEMS = [
  {
    key: 'deliveries',
    label: 'Миний хүргэлт',
    icon: Truck,
    path: '/deliveries',
    roles: ['DRIVER'],
  },
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
  {
    key: 'orders',
    label: 'Захиалга',
    icon: ClipboardList,
    path: '/orders',
    perm: 'orders.view',
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
    // v2-ын харагдац (ADMIN+MANAGER)-тай ижил — adjust хийдэг хүнд л цэс
    perm: 'inventory.adjustment',
  },
  {
    key: 'delivery-ops',
    label: 'Хүргэлтийн удирдлага',
    icon: Map,
    path: '/delivery-ops',
    // board нь orders.view+drivers.view хоёуланг шаарддаг — цэсэнд
    // илүү хязгаарлагч drivers.view-г ашиглана
    perm: 'drivers.view',
  },
  {
    key: 'finance',
    label: 'Санхүү',
    icon: Wallet,
    path: '/finance',
    end: true,
    // Орлого эсвэл зарлагын аль нэгийг харж чаддаг бол цэс гарна
    anyPerm: ['finance.view_income', 'finance.view_expense'],
  },
  {
    key: 'payroll',
    label: 'Жолоочийн цалин',
    icon: HandCoins,
    path: '/finance/payroll',
    perm: 'finance.driver_payroll',
  },
  {
    key: 'users',
    label: 'Хэрэглэгчид',
    icon: Users,
    path: '/users',
    perm: 'users.manage',
  },
  {
    key: 'activity',
    label: 'Үйлдлийн түүх',
    icon: ScrollText,
    path: '/activity-log',
    perm: 'activity_log.view',
  },
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
