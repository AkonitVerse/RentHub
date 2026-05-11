export type UserRole = 'ADMIN' | 'MANAGER' | 'USER';

/** Физическое состояние единицы. «Занятость» — отдельно через Reservation. */
export type WarehouseItemStatus = 'OPERATIONAL' | 'BROKEN' | 'RETIRED';

/** Производный статус для UI: «доступна сейчас». */
export type WarehouseAvailability = 'AVAILABLE' | 'RESERVED' | 'RENTED' | 'BROKEN' | 'RETIRED';

export type OrderStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'CONFIRMED'
  | 'ACTIVE'
  | 'OVERDUE'
  | 'DONE'
  | 'CANCELLED';

/** Источник заказа: создан в админке, оформлен из корзины витрины, инквайри. */
export type OrderSource = 'MANUAL' | 'WEB_CART' | 'WEB_INQUIRY';

export type DeliveryMethod = 'PICKUP' | 'DELIVERY';

export type ReservationStatus = 'PLANNED' | 'ACTIVE' | 'RETURNED' | 'CANCELLED';

export interface User {
  id: number;
  email: string;
  /** Телефон пользователя. Может быть null у админа/менеджера. */
  phone: string | null;
  firstName: string;
  lastName: string;
  /** Полное имя (denormalized): firstName + ' ' + lastName. */
  name: string;
  role: UserRole;
  createdAt?: string;
}

export interface UserWithClient extends User {
  client?: Client | null;
}

// =====================
// Категории (с иерархией)
// =====================

export interface Category {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  parentId: number | null;
  _count?: { catalogItems: number; children: number };
}

export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
  /** Активные карточки в этой категории (прямой счёт). */
  catalogCount: number;
  /** Активные карточки с ≥1 рабочей единицей (прямой). */
  visibleCatalogCount: number;
  /** Активные карточки во всём поддереве (включая потомков). */
  catalogCountTotal: number;
  /** Физические единицы (через привязку к карточкам) во всём поддереве. */
  unitCount: number;
}

// =====================
// Ценовые тиры
// =====================

export interface PricingTier {
  id: number;
  rank: number;
  minDays: number;
  maxDays: number | null;
  note: string | null;
}

export interface CatalogItemPrice {
  id: number;
  catalogItemId: number;
  tierId: number;
  pricePerDay: number;
  isOverridden?: boolean;
  tier?: PricingTier;
}

// =====================
// Каталог
// =====================

export interface Equipment {
  id: number;
  sku: string;
  name: string;
  categoryId: number | null;
  category?: Category | null;
  description: string;
  fullDesc: string | null;
  deposit: number;
  isActive: boolean;
  isFeatured?: boolean;
  rating: number;
  reviewCount: number;
  photos: string[] | null;
  specs: Record<string, string> | null;
  prices?: CatalogItemPrice[];
  warehouseItems?: WarehouseItem[];
  totalUnits?: number;
  availableUnits?: number;
  createdAt: string;
  updatedAt: string;
  _count?: { warehouseItems: number };
}

// =====================
// Склад
// =====================

export interface WarehouseItem {
  id: number;
  name: string;
  inventoryNumber: string;
  serialNumber: string | null;
  status: WarehouseItemStatus;
  /** Производный статус для UI («занята сейчас» по Reservation). */
  availability?: WarehouseAvailability;
  /** Категория наследуется от привязанной карточки (catalogItem.category). */
  categoryId: number | null;
  category?: { id: number; name: string; slug: string } | null;
  catalogItemId: number | null;
  catalogItem?: {
    id: number;
    sku: string;
    name: string;
    categoryId?: number;
    category?: { id: number; name: string; slug: string };
  } | null;
  /** Дата покупки (ISO). */
  purchaseDate?: string | null;
  /** Закупочная цена в рублях. */
  purchasePrice?: number | null;
  /** Гарантия действует до этой даты (ISO). */
  warrantyUntil?: string | null;
  /** Заметка о состоянии (свободный текст). */
  notes?: string | null;
  reservations?: Reservation[];
  createdAt: string;
  updatedAt: string;
}

// =====================
// Резервы
// =====================

export interface Reservation {
  id: number;
  orderLineId: number;
  warehouseItemId: number;
  fromDate: string;
  toDate: string;
  status: ReservationStatus;
  createdAt: string;
  updatedAt: string;
}

// =====================
// Клиенты
// =====================

export type ClientType = 'INDIVIDUAL' | 'COMPANY';

export interface Client {
  id: number;
  clientType: ClientType;
  name: string;
  phone: string;
  email: string | null;
  userId?: number | null;
  user?: User | null;
  // Реквизиты юрлица
  inn?: string | null;
  kpp?: string | null;
  ogrn?: string | null;
  legalAddress?: string | null;
  contactPerson?: string | null;
  contactPosition?: string | null;
  contactPhone?: string | null;
  bankAccount?: string | null;
  bankBik?: string | null;
  bankName?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { orders: number };
  orders?: Order[];
  totalSpent?: number;
}

// =====================
// Заказы
// =====================

export interface RentalExtension {
  id: number;
  orderLineId: number;
  oldToDate: string;
  newToDate: string;
  addedDays: number;
  addedAmount: number;
  createdById: number | null;
  createdBy?: { id: number; name: string } | null;
  createdAt: string;
}

export interface OrderLine {
  id: number;
  orderId: number;
  equipmentId: number;
  equipment?: Equipment;
  warehouseItemId: number | null;
  warehouseItem?: WarehouseItem | null;
  qty: number;
  days: number;
  unitPriceNet: number;
  sumAmount: number;
  unitTag: string | null;
  returnedAt: string | null;
  pricingTierRank?: number | null;
  pricingTierMinDays?: number | null;
  pricingTierMaxDays?: number | null;
  catalogItemDeposit?: number | null;
  snapshotAt?: string | null;
  reservations?: Reservation[];
  extensions?: RentalExtension[];
}

export interface OrderStatusLogEntry {
  id: number;
  orderId: number;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  changedAt: string;
  note: string | null;
  changedBy?: { id: number; name: string; email: string } | null;
}

export interface Order {
  id: number;
  number: string;
  clientId: number;
  client?: Client;
  status: OrderStatus;
  source: OrderSource;
  inquiryNote: string | null;
  inquiryEquipmentId: number | null;
  inquiryEquipment?: { id: number; sku: string; name: string } | null;
  /** Для DRAFT/WEB_INQUIRY могут быть null. */
  fromDate: string | null;
  toDate: string | null;
  daysCount: number | null;
  totalAmount: number;
  deposit: number;
  deliveryMethod: DeliveryMethod;
  address: string | null;
  contactPhone: string;
  contactEmail: string | null;
  notes: string | null;
  lines?: OrderLine[];
  statusLog?: OrderStatusLogEntry[];
  createdAt: string;
  updatedAt: string;
  _count?: { lines: number };
}

// =====================
// Корзина (серверная)
// =====================

export interface CartLineComputed {
  catalogItemId: number;
  qty: number;
  fromDate: string;
  toDate: string;
  addedAt: string;
  days: number;
  unitPriceNet: number;
  sumAmount: number;
  name: string;
  sku: string;
  deposit: number;
  photo: string | null;
  available: boolean;
  freeQty: number;
  tierRank: number | null;
  tierMinDays: number | null;
  tierMaxDays: number | null;
}

export interface CartView {
  sessionId: string;
  lines: CartLineComputed[];
  totalAmount: number;
  totalDeposit: number;
  totalQty: number;
  updatedAt: string;
  hasIssues: boolean;
}

// =====================
// Прочее
// =====================

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface DashboardStats {
  monthRevenue: number;
  pendingRevenue: number;
  activeOrders: number;
  overdueOrders: number;
  todayOrders: number;
  utilization: number;
}

export interface RevenuePoint {
  date: string;
  value: number;
}

export interface TopEquipmentPoint {
  id: number;
  name: string;
  revenue: number;
  util: number;
}

export interface UtilizationPoint {
  date: string;
  busy: number;
  utilization: number;
}

export interface OrderPreviewResult {
  days: number;
  lines: Array<{
    catalogItemId: number;
    qty: number;
    days: number;
    unitPriceNet: number;
    sumAmount: number;
    appliedTier: PricingTier | null;
  }>;
  totalAmount: number;
}

export interface AvailabilityResult {
  catalogItemId: number;
  from: string;
  to: string;
  busyDates: string[];
}
