import { Role } from '../generated/prisma/client';

/**
 * Бүх permission түлхүүр — системд НЭГ Л ГАЗАР энд тодорхойлогдоно.
 * Effective permission = UserPermission override байвал түүнийх,
 * үгүй бол ROLE_DEFAULTS.
 */
export const PERM = {
  // Захиалга
  ORDERS_VIEW: 'orders.view',
  ORDERS_CREATE: 'orders.create',
  ORDERS_EDIT: 'orders.edit',
  ORDERS_DELETE: 'orders.delete',
  ORDERS_ASSIGN_DRIVER: 'orders.assign_driver',
  ORDERS_CHANGE_STATUS: 'orders.change_status',
  ORDERS_REFUND: 'orders.refund',
  // Харилцагч
  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_CREATE: 'customers.create',
  CUSTOMERS_EDIT: 'customers.edit',
  CUSTOMERS_DELETE: 'customers.delete',
  // Жолооч
  DRIVERS_VIEW: 'drivers.view',
  DRIVERS_ASSIGN: 'drivers.assign',
  // Агуулах
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_STOCK_IN: 'inventory.stock_in',
  INVENTORY_STOCK_OUT: 'inventory.stock_out',
  INVENTORY_ADJUSTMENT: 'inventory.adjustment',
  // Санхүү
  FINANCE_VIEW_INCOME: 'finance.view_income',
  FINANCE_CREATE_INCOME: 'finance.create_income',
  FINANCE_VIEW_EXPENSE: 'finance.view_expense',
  FINANCE_CREATE_EXPENSE: 'finance.create_expense',
  FINANCE_DRIVER_PAYROLL: 'finance.driver_payroll',
  FINANCE_VIEW_RECEIVABLES: 'finance.view_receivables',
  // Тайлан
  REPORTS_DELIVERY: 'reports.delivery',
  REPORTS_INVENTORY: 'reports.inventory',
  REPORTS_FINANCE: 'reports.finance',
  // Систем
  USERS_MANAGE: 'users.manage',
  PERMISSIONS_MANAGE: 'permissions.manage',
  SETTINGS_EDIT: 'settings.edit',
  ACTIVITY_LOG_VIEW: 'activity_log.view',
  ANALYTICS_VIEW: 'analytics.view',
} as const;

export type PermKey = (typeof PERM)[keyof typeof PERM];

/** Бүх түлхүүрийн жагсаалт (permissions.manage UI-д хэрэглэнэ) */
export const ALL_PERMISSIONS: PermKey[] = Object.values(PERM);

/** Түлхүүр бүрийн монгол нэр — Permission Panel-д харагдана */
export const PERM_LABELS: Record<PermKey, string> = {
  [PERM.ORDERS_VIEW]: 'Захиалга харах',
  [PERM.ORDERS_CREATE]: 'Захиалга үүсгэх',
  [PERM.ORDERS_EDIT]: 'Захиалга засах',
  [PERM.ORDERS_DELETE]: 'Захиалга устгах',
  [PERM.ORDERS_ASSIGN_DRIVER]: 'Жолооч хуваарилах',
  [PERM.ORDERS_CHANGE_STATUS]: 'Захиалгын статус солих',
  [PERM.ORDERS_REFUND]: 'Буцаалт бүртгэх',
  [PERM.CUSTOMERS_VIEW]: 'Харилцагч харах',
  [PERM.CUSTOMERS_CREATE]: 'Харилцагч бүртгэх',
  [PERM.CUSTOMERS_EDIT]: 'Харилцагч засах',
  [PERM.CUSTOMERS_DELETE]: 'Харилцагч устгах',
  [PERM.DRIVERS_VIEW]: 'Жолооч харах',
  [PERM.DRIVERS_ASSIGN]: 'Жолооч томилох',
  [PERM.INVENTORY_VIEW]: 'Агуулах харах',
  [PERM.INVENTORY_STOCK_IN]: 'Орлого авах',
  [PERM.INVENTORY_STOCK_OUT]: 'Зарлага гаргах',
  [PERM.INVENTORY_ADJUSTMENT]: 'Тохируулга хийх',
  [PERM.FINANCE_VIEW_INCOME]: 'Орлогын гүйлгээ харах',
  [PERM.FINANCE_CREATE_INCOME]: 'Орлогын гүйлгээ бүртгэх',
  [PERM.FINANCE_VIEW_EXPENSE]: 'Зарлагын гүйлгээ харах',
  [PERM.FINANCE_CREATE_EXPENSE]: 'Зарлагын гүйлгээ бүртгэх',
  [PERM.FINANCE_DRIVER_PAYROLL]: 'Жолоочийн цалин бодох',
  [PERM.FINANCE_VIEW_RECEIVABLES]: 'Авлага харах',
  [PERM.REPORTS_DELIVERY]: 'Хүргэлтийн тайлан',
  [PERM.REPORTS_INVENTORY]: 'Агуулахын тайлан',
  [PERM.REPORTS_FINANCE]: 'Санхүүгийн тайлан',
  [PERM.USERS_MANAGE]: 'Хэрэглэгч удирдах',
  [PERM.PERMISSIONS_MANAGE]: 'Эрхийн тохиргоо удирдах',
  [PERM.SETTINGS_EDIT]: 'Тохиргоо засах',
  [PERM.ACTIVITY_LOG_VIEW]: 'Үйлдлийн түүх харах',
  [PERM.ANALYTICS_VIEW]: 'Аналитик харах',
};

/** Panel-ын бүлэглэлт — дараалал нь UI-ийн дараалал */
export const PERM_GROUPS: { group: string; keys: PermKey[] }[] = [
  {
    group: 'ORDERS',
    keys: [
      PERM.ORDERS_VIEW,
      PERM.ORDERS_CREATE,
      PERM.ORDERS_EDIT,
      PERM.ORDERS_DELETE,
      PERM.ORDERS_ASSIGN_DRIVER,
      PERM.ORDERS_CHANGE_STATUS,
      PERM.ORDERS_REFUND,
    ],
  },
  {
    group: 'CUSTOMERS',
    keys: [
      PERM.CUSTOMERS_VIEW,
      PERM.CUSTOMERS_CREATE,
      PERM.CUSTOMERS_EDIT,
      PERM.CUSTOMERS_DELETE,
    ],
  },
  { group: 'DRIVERS', keys: [PERM.DRIVERS_VIEW, PERM.DRIVERS_ASSIGN] },
  {
    group: 'INVENTORY',
    keys: [
      PERM.INVENTORY_VIEW,
      PERM.INVENTORY_STOCK_IN,
      PERM.INVENTORY_STOCK_OUT,
      PERM.INVENTORY_ADJUSTMENT,
    ],
  },
  {
    group: 'FINANCE',
    keys: [
      PERM.FINANCE_VIEW_INCOME,
      PERM.FINANCE_CREATE_INCOME,
      PERM.FINANCE_VIEW_EXPENSE,
      PERM.FINANCE_CREATE_EXPENSE,
      PERM.FINANCE_DRIVER_PAYROLL,
      PERM.FINANCE_VIEW_RECEIVABLES,
    ],
  },
  {
    group: 'REPORTS',
    keys: [PERM.REPORTS_DELIVERY, PERM.REPORTS_INVENTORY, PERM.REPORTS_FINANCE],
  },
  {
    group: 'SYSTEM',
    keys: [
      PERM.USERS_MANAGE,
      PERM.PERMISSIONS_MANAGE,
      PERM.SETTINGS_EDIT,
      PERM.ACTIVITY_LOG_VIEW,
      PERM.ANALYTICS_VIEW,
    ],
  },
];

/**
 * Эрх тус бүрийн default матриц — v2-ын зан төлөвтэй ЯГ ижил.
 *
 * - ADMIN: бүгд. Override-аар ХАСАГДАХГҮЙ (permission service үргэлж
 *   бүгдийг ✅ буцаана) — энэ дүрэм PermissionsService-д хатуу шалгагдана.
 * - OPERATOR-ийн orders.change_status "зөвхөн өөрийн шивсэн захиалга"
 *   гэсэн нарийвчлал permission биш — OrdersService доторх ownership
 *   шалгалт хэвээр хариуцна.
 * - DRIVER: юу ч биш — /deliveries/* endpoint-ууд permission биш
 *   @Roles(DRIVER)-оор хэвээр хамгаалагдана.
 * - CUSTOMER: юу ч биш — portal endpoint-ууд тусдаа (Бүлэг 2).
 */
export const ROLE_DEFAULTS: Record<Role, PermKey[]> = {
  [Role.ADMIN]: ALL_PERMISSIONS,
  [Role.MANAGER]: [
    PERM.ORDERS_VIEW,
    PERM.ORDERS_EDIT,
    PERM.ORDERS_CHANGE_STATUS,
    PERM.ORDERS_ASSIGN_DRIVER,
    PERM.ORDERS_REFUND, // V4: буцаалт ADMIN+MANAGER
    PERM.INVENTORY_VIEW,
    PERM.INVENTORY_STOCK_IN,
    PERM.INVENTORY_STOCK_OUT,
    PERM.INVENTORY_ADJUSTMENT,
    PERM.DRIVERS_VIEW,
    PERM.DRIVERS_ASSIGN,
    PERM.FINANCE_VIEW_INCOME,
    PERM.FINANCE_CREATE_INCOME,
    PERM.FINANCE_VIEW_EXPENSE,
    PERM.FINANCE_CREATE_EXPENSE,
    PERM.FINANCE_DRIVER_PAYROLL,
    PERM.FINANCE_VIEW_RECEIVABLES, // V4: авлага ADMIN+MANAGER-т
    PERM.REPORTS_DELIVERY,
    PERM.REPORTS_INVENTORY,
    PERM.ANALYTICS_VIEW, // V3-16: аналитик ADMIN+MANAGER-т
    PERM.CUSTOMERS_VIEW, // V3-17: харилцагчийн жагсаалт ADMIN+MANAGER-т
  ],
  [Role.OPERATOR]: [
    PERM.ORDERS_VIEW,
    PERM.ORDERS_CREATE,
    PERM.ORDERS_CHANGE_STATUS,
    PERM.INVENTORY_VIEW,
  ],
  [Role.DRIVER]: [],
  [Role.CUSTOMER]: [],
};
