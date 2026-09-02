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
  totalProfit: unknown; // Decimal — борлуулалт − борлуулсан барааны өртөг (v4)
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

/**
 * GET /api/dashboard/operator — ХАРИЛЦАГЧИЙН (нийлүүлэгчийн) самбар.
 *
 * Гаднын түнш тул зөвхөн ӨӨРИЙН компанийн мэдээлэл: юу нийлүүлсэн,
 * бид хэд өртэй, аль бараа нь дуусч байна. Захиалга, бусад компанийн
 * бараа, дотоод тоо энд ОРОХГҮЙ.
 */
export type OperatorDashboard = {
  company: { id: string; name: string } | null;
  supplies: number;
  totalCost: unknown;
  paidAmount: unknown;
  dueAmount: unknown;
  lastSupplyAt: Date | null;
  /** Өөрийнх нь нийлүүлдэг, лимитээс доош орсон бараа */
  lowStockProducts: {
    id: string;
    name: string;
    stockQty: number;
    lowStockLimit: number;
  }[];
  recentSupplies: {
    id: string;
    number: string;
    createdAt: Date;
    totalCost: unknown;
    dueAmount: unknown;
    items: string;
  }[];
};

/**
 * GET /api/dashboard/seller — борлуулагчийн ажлын дараалал (V5).
 * Хүсэлт → батлах → жолооч хуваарилах гэсэн гурван алхмын аль нь
 * гацаж байгааг нэг харцаар харуулна.
 */
export type SellerDashboard = {
  newRequests: number; // хүлээгдэж буй хүсэлт
  convertedToday: number; // өнөөдөр захиалга болгосон
  unassignedOrders: number; // жолооч хүлээж буй захиалга
  releasedToday: number; // өнөөдөр хүргэлтэд гаргасан
  pendingRequests: {
    id: string;
    customerName: string;
    phone: string;
    socialName: string | null;
    channel: string;
    paid: boolean;
    createdAt: Date;
  }[];
  awaitingDriver: {
    id: string;
    orderNo: string;
    customerName: string | null;
    phone: string;
    shortAddress: string;
    district: string | null;
    totalAmount: unknown;
    createdAt: Date;
  }[];
  /** Амжилтгүй болсон хүргэлтүүд — хэрэглэгчтэй эргэж холбогдоно */
  failedDeliveries: {
    id: string;
    orderNo: string;
    customerName: string | null;
    phone: string;
    shortAddress: string;
    driverName: string | null;
    deliveryNote: string | null;
    totalAmount: unknown;
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
