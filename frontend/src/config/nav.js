import { Boxes, ClipboardList, Home, Package, Truck, Users } from 'lucide-react'

/**
 * Sidebar-ын цэсийн нэгдсэн config.
 * perm — одоохондоо эрхийн жагсаалт; Бүлэг 1-д permission түлхүүр болж солигдоно.
 * Дараалал чухал: DRIVER-т "Миний хүргэлт" хамгийн эхэнд гарна.
 */
export const NAV_ITEMS = [
  {
    key: 'deliveries',
    label: 'Миний хүргэлт',
    icon: Truck,
    path: '/deliveries',
    perm: ['DRIVER'],
  },
  {
    key: 'home',
    label: 'Нүүр',
    icon: Home,
    path: '/',
    end: true,
    perm: ['ADMIN', 'MANAGER', 'OPERATOR', 'DRIVER'],
  },
  {
    key: 'orders',
    label: 'Захиалга',
    icon: ClipboardList,
    path: '/orders',
    perm: ['ADMIN', 'MANAGER', 'OPERATOR'],
  },
  {
    key: 'products',
    label: 'Бараа',
    icon: Package,
    path: '/products',
    perm: ['ADMIN', 'MANAGER', 'OPERATOR'],
  },
  {
    key: 'stock',
    label: 'Агуулах',
    icon: Boxes,
    path: '/stock',
    perm: ['ADMIN', 'MANAGER'],
  },
  {
    key: 'users',
    label: 'Хэрэглэгчид',
    icon: Users,
    path: '/users',
    perm: ['ADMIN'],
  },
]

/** Тухайн эрхэд харагдах цэсүүд (дарааллаа хадгална) */
export function navForRole(role) {
  if (!role) return []
  return NAV_ITEMS.filter((item) => item.perm.includes(role))
}
