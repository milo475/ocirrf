/**
 * 4 эрхийн dashboard-ийн mock — backend-ийн
 * src/dashboard/dashboard.types.ts дахь хэлбэрүүдтэй ЯГ ижил.
 * API холбогдохоор нэг мөрөөр солигдоно.
 */

/** Өнөөдрийг оруулаад сүүлийн 7 хоногийн YYYY-MM-DD жагсаалт */
function last7Dates() {
  const out = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    out.push(
      new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
        .toISOString()
        .slice(0, 10),
    )
  }
  return out
}
const DATES = last7Dates()

/** AdminDashboard */
export const mockAdminDashboard = {
  totalCustomers: 42,
  totalDrivers: 4,
  deliveriesInProgress: 6,
  deliveredTotal: 128,
  totalIncome: '2450000.00',
  last7Days: DATES.map((date, i) => ({
    date,
    ordersCreated: [5, 8, 6, 9, 4, 7, 10][i],
    delivered: [4, 7, 5, 8, 3, 6, 8][i],
  })),
  topDrivers: [
    { id: 'mock-d1', name: 'Хүргэлтийн Жолооч', assigned: 40, delivered: 38, dr: 0.95 },
    { id: 'mock-d2', name: 'Бат-Оргил', assigned: 35, delivered: 31, dr: 0.89 },
    { id: 'mock-d3', name: 'Тэмүүжин', assigned: 28, delivered: 23, dr: 0.82 },
  ],
}

/** OperatorDashboard */
export const mockOperatorDashboard = {
  myOrdersTotal: 57,
  myDelivered: 49,
  myDr: 0.86,
  last7Days: DATES.map((date, i) => ({ date, count: [3, 5, 4, 7, 2, 6, 8][i] })),
  lowStockProducts: [
    { id: 'mock-p1', name: 'Сүү 1л', sku: 'UG-0002', stockQty: 3, lowStockLimit: 10 },
    { id: 'mock-p2', name: 'Утасны цэнэглэгч Type-C', sku: 'UG-0008', stockQty: 2, lowStockLimit: 5 },
    { id: 'mock-p3', name: 'Гоймон 400г', sku: 'UG-0004', stockQty: 0, lowStockLimit: 5 },
  ],
}

/** ManagerDashboard */
export const mockManagerDashboard = {
  stockLast7Days: DATES.map((date, i) => ({
    date,
    in: [20, 0, 35, 10, 0, 50, 12][i],
    out: [14, 18, 22, 9, 16, 25, 19][i],
  })),
  awaitingAssignment: [
    {
      id: 'mock-o1',
      orderNo: 'ORD-20260825-0011',
      customerName: 'Бат-Эрдэнэ',
      phone: '99112233',
      address: 'СБД 1-р хороо, 25-12',
      totalAmount: '37500.00',
      orderStatus: 'CONFIRMED',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'mock-o2',
      orderNo: 'ORD-20260825-0012',
      customerName: 'Оюунаа',
      phone: '95059911',
      address: 'ХУД 3-р хороо, 12-5',
      totalAmount: '12800.00',
      orderStatus: 'PREPARING',
      createdAt: new Date().toISOString(),
    },
  ],
  driverLoad: [
    { id: 'mock-d1', name: 'Хүргэлтийн Жолооч', isAvailable: true, active: 2 },
    { id: 'mock-d2', name: 'Бат-Оргил', isAvailable: true, active: 4 },
    { id: 'mock-d3', name: 'Тэмүүжин', isAvailable: false, active: 0 },
  ],
}

/** DriverDashboard (DeliveryService.myStats хэлбэр) */
export const mockDriverDashboard = {
  totalDelivered: 38,
  assignedThisWeek: 9,
  deliveredThisWeek: 8,
  last7Days: DATES.map((date, i) => ({ date, delivered: [1, 2, 0, 2, 1, 1, 1][i] })),
  feePerDelivery: '3000.00',
  unpaidCount: 6,
  earnings: {
    unpaid: '18000.00',
    pendingPayout: '24000.00',
    paidTotal: '72000.00',
  },
}
