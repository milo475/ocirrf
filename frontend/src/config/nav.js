import {
  Boxes,
  ClipboardList,
  HandCoins,
  Home,
  Package,
  Truck,
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
