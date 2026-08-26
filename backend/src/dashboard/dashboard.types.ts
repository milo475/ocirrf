/**
 * Dashboard endpoint-уудын буцаах хэлбэрүүд.
 * Frontend-ийн mock өгөгдлийг эдгээртэй ЯГ тулгаж бичнэ.
 */

/** GET /api/dashboard/admin */
export type AdminDashboard = {
  totalCustomers: number; // Order.phone distinct
  totalDrivers: number; // идэвхтэй DRIVER тоо
  deliveriesInProgress: number; // ASSIGNED + ON_THE_WAY
  deliveredTotal: number;
  totalIncome: unknown; // Decimal — FinanceEntry INCOME нийлбэр
  last7Days: { date: string; ordersCreated: number; delivered: number }[];
  /** DR = delivered/assigned, багадаа 1 хуваарилалттай жолооч, TOP-3 */
  topDrivers: {
    id: string;
    name: string;
    assigned: number;
    delivered: number;
    dr: number; // 0–1, 2 орны нарийвчлалтай
  }[];
};

/** GET /api/dashboard/operator */
export type OperatorDashboard = {
  myOrdersTotal: number;
  myDelivered: number;
  myDr: number; // 0–1
  last7Days: { date: string; count: number }[];
  lowStockProducts: {
    id: string;
    name: string;
    sku: string;
    stockQty: number;
    lowStockLimit: number;
  }[];
};

/** GET /api/dashboard/manager */
export type ManagerDashboard = {
  stockLast7Days: { date: string; in: number; out: number }[];
  awaitingAssignment: {
    id: string;
    orderNo: string;
    customerName: string | null;
    phone: string;
    region: string;
    district: string | null;
    khoroo: string | null;
    province: string | null;
    soum: string | null;
    shortAddress: string;
    totalAmount: unknown; // Prisma.Decimal — JSON-д string болно
    orderStatus: string;
    createdAt: Date;
  }[];
  driverLoad: {
    id: string;
    name: string;
    isAvailable: boolean | null;
    active: number; // дуусаагүй хүргэлтийн тоо
  }[];
};

/** GET /api/dashboard/driver — DeliveryService.myStats-ийн хэлбэр */
export type DriverDashboard = {
  totalDelivered: number;
  assignedThisWeek: number;
  deliveredThisWeek: number;
  last7Days: { date: string; delivered: number }[];
  feePerDelivery: unknown; // Decimal
  unpaidCount: number; // тооцоонд ороогүй хүргэлт
  earnings: {
    unpaid: unknown; // Decimal — unpaidCount × feePerDelivery
    pendingPayout: unknown; // Decimal — хаагдсан, олгоогүй тооцоо
    paidTotal: unknown; // Decimal — олгосон нийт
  };
};
