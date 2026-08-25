/**
 * frontend/DASHBOARD.md Алхам 3-ын mock бүтэцтэй ЯГ ИЖИЛ хэлбэр.
 * Инвариант: 55 + sum(drivers.points) === stockHealth,
 * healthHistory нь 13 утгатай, сүүлийнх нь === stockHealth.
 */
export type StockDriver = { label: string; points: number };

export type ProductHealth = {
  id: string;
  sku: string;
  name: string;
  category: string;
  monthlySales: number;
  stockQty: number;
  reorderLevel: number;
  stockHealth: number; // 0-100
  supplier: string;
  lastRestocked: string; // ISO
  nextRestockDate: string; // ISO
  turnoverRate: number | null; // 0-1
  drivers: StockDriver[];
  healthHistory: number[];
};
