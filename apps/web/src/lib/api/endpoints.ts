import { api } from './client';
import type {
  AvailabilityResult,
  CartView,
  Category,
  CategoryTreeNode,
  Client,
  DashboardStats,
  Equipment,
  Order,
  OrderPreviewResult,
  OrderSource,
  OrderStatus,
  PaginatedResponse,
  PricingTier,
  RentalExtension,
  RevenuePoint,
  TopEquipmentPoint,
  User,
  UserWithClient,
  UtilizationPoint,
  WarehouseItem,
  WarehouseItemStatus,
} from './types';

// === AUTH ===
export interface RegisterInput {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  phone: string;
}

export const authApi = {
  login: (email: string, password: string) =>
    api
      .post<{ id: number; email: string; name: string; role: 'ADMIN' | 'MANAGER' | 'USER' }>(
        '/auth/login',
        {
          email,
          password,
        },
      )
      .then((r) => r.data),
  register: (data: RegisterInput) =>
    api
      .post<
        | { requiresVerification: true; email: string }
        | {
            requiresVerification: false;
            id: number;
            email: string;
            name: string;
            role: 'ADMIN' | 'MANAGER' | 'USER';
          }
      >('/auth/register', data)
      .then((r) => r.data),
  verifyEmail: (email: string, code: string) =>
    api
      .post<{
        id: number;
        email: string;
        name: string;
        role: 'ADMIN' | 'MANAGER' | 'USER';
      }>('/auth/verify-email', { email, code })
      .then((r) => r.data),
  resendVerification: (email: string) =>
    api.post<{ ok: true }>('/auth/resend-verification', { email }).then((r) => r.data),
  logout: () => api.post('/auth/logout').then((r) => r.data),
  me: () => api.get<User>('/auth/me').then((r) => r.data),
  forgotPassword: (email: string) =>
    api.post<{ ok: true }>('/auth/forgot-password', { email }).then((r) => r.data),
  verifyResetCode: (email: string, code: string) =>
    api.post<{ ok: true }>('/auth/verify-reset-code', { email, code }).then((r) => r.data),
  resetPassword: (email: string, code: string, newPassword: string) =>
    api
      .post<{ ok: true }>('/auth/reset-password', { email, code, newPassword })
      .then((r) => r.data),
};

// === CATEGORIES ===
export interface CreateCategoryInput {
  name: string;
  description?: string;
  icon?: string;
  parentId?: number | null;
  sortOrder?: number;
}

export const categoriesApi = {
  list: () => api.get<Category[]>('/categories').then((r) => r.data),
  tree: (visibleOnly = false) =>
    api
      .get<CategoryTreeNode[]>('/categories/tree', { params: { visibleOnly } })
      .then((r) => r.data),
  byId: (id: number) => api.get<Category>(`/categories/${id}`).then((r) => r.data),
  create: (data: CreateCategoryInput) =>
    api.post<Category>('/categories', data).then((r) => r.data),
  update: (id: number, data: Partial<CreateCategoryInput>) =>
    api.patch<Category>(`/categories/${id}`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/categories/${id}`).then((r) => r.data),
  bulkAttachEquipment: (categoryId: number, equipmentIds: number[]) =>
    api
      .post<{ attached: number }>(`/categories/${categoryId}/equipment/bulk-attach`, {
        equipmentIds,
      })
      .then((r) => r.data),
  bulkMoveEquipment: (targetCategoryId: number, equipmentIds: number[]) =>
    api
      .post<{ moved: number }>(`/categories/equipment/bulk-move`, {
        targetCategoryId,
        equipmentIds,
      })
      .then((r) => r.data),
  bulkMoveCategories: (targetParentId: number | null, categoryIds: number[]) =>
    api
      .post<{ moved: number }>(`/categories/bulk-move`, {
        targetParentId,
        categoryIds,
      })
      .then((r) => r.data),
  config: () => api.get<{ maxDepth: number }>('/categories/config').then((r) => r.data),
};

// === EQUIPMENT (CATALOG) ===
export interface EquipmentListParams {
  categoryId?: number;
  search?: string;
  isActive?: boolean;
  isFeatured?: boolean;
  /** name | -name | rating | -rating | price | -price | new | -new */
  sort?: string;
  /** Доступность на конкретный период — фильтрует карточки с availableUnits === 0 на этом окне. */
  availableFrom?: string;
  availableTo?: string;
  page?: number;
  limit?: number;
}

export interface CreateEquipmentInput {
  /** Опционально. Если не передан — бэк сгенерирует «EQ-NNNNNN». */
  sku?: string;
  name: string;
  categoryId?: number | null;
  description: string;
  fullDesc?: string;
  basePrice: number;
  deposit?: number;
  isActive?: boolean;
  specs?: Record<string, string>;
}

export interface ActivationStatus {
  canActivate: boolean;
  tiersTotal: number;
  tiersFilled: number;
  tiersMissing: number;
  operationalUnits: number;
}

export const equipmentApi = {
  list: (params?: EquipmentListParams) =>
    api.get<PaginatedResponse<Equipment>>('/equipment', { params }).then((r) => r.data),
  byId: (id: number) => api.get<Equipment>(`/equipment/${id}`).then((r) => r.data),
  availability: (id: number, from: string, to: string) =>
    api
      .get<AvailabilityResult>(`/equipment/${id}/availability`, { params: { from, to } })
      .then((r) => r.data),
  activationStatus: (id: number) =>
    api.get<ActivationStatus>(`/equipment/${id}/activation-status`).then((r) => r.data),
  create: (data: CreateEquipmentInput) =>
    api.post<Equipment>('/equipment', data).then((r) => r.data),
  update: (id: number, data: Partial<CreateEquipmentInput>) =>
    api.put<Equipment>(`/equipment/${id}`, data).then((r) => r.data),
  setTierPrice: (id: number, tierId: number, pricePerDay: number) =>
    api.patch(`/equipment/${id}/tier-price`, { tierId, pricePerDay }).then((r) => r.data),
  archive: (id: number) => api.post<Equipment>(`/equipment/${id}/archive`).then((r) => r.data),
  unarchive: (id: number) => api.post<Equipment>(`/equipment/${id}/unarchive`).then((r) => r.data),
  remove: (id: number) => api.delete(`/equipment/${id}`).then((r) => r.data),
  uploadPhoto: (id: number, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api
      .post<Equipment>(`/equipment/${id}/photo`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
  setPhotos: (id: number, photos: string[]) =>
    api.patch<Equipment>(`/equipment/${id}/photos`, { photos }).then((r) => r.data),
  startMaintenance: (warehouseItemId: number, reason: string, cost?: number) =>
    api.post('/equipment/maintenance', { warehouseItemId, reason, cost }).then((r) => r.data),
  endMaintenance: (maintenanceId: number) =>
    api.put(`/equipment/maintenance/${maintenanceId}/end`).then((r) => r.data),
};

// === PRICING TIERS ===
export interface RecalcPreviewItem {
  catalogItemId: number;
  catalogItemName: string;
  sku: string;
  tierOnePrice: number;
  currentPrice: number | null;
  newPrice: number;
  changed: boolean;
}

export interface RecalcPreview {
  tierId: number;
  discountPercent: number;
  items: RecalcPreviewItem[];
  summary: { total: number; willChange: number; willCreate: number; unchanged: number };
}

export const tiersApi = {
  list: () => api.get<PricingTier[]>('/pricing/tiers').then((r) => r.data),
  add: (closeAtDays: number, discountPercent: number) =>
    api.post<PricingTier>('/pricing/tiers', { closeAtDays, discountPercent }).then((r) => r.data),
  updateBoundary: (tierId: number, maxDays: number) =>
    api.patch<PricingTier>(`/pricing/tiers/${tierId}/boundary`, { maxDays }).then((r) => r.data),
  deleteLast: () => api.delete<{ deletedId: number }>('/pricing/tiers/last').then((r) => r.data),
  previewRecalculate: (tierId: number, discountPercent: number) =>
    api
      .post<RecalcPreview>(`/pricing/tiers/${tierId}/recalculate/preview`, { discountPercent })
      .then((r) => r.data),
  recalculate: (tierId: number, discountPercent: number) =>
    api
      .post<{
        updated: number;
        skipped: number;
      }>(`/pricing/tiers/${tierId}/recalculate`, { discountPercent })
      .then((r) => r.data),
};

// === WAREHOUSE ===
export interface WarehouseListParams {
  search?: string;
  status?: WarehouseItemStatus;
  /** Фильтр по категории — собирает единицы карточек этой категории и потомков. */
  categoryId?: number;
  catalogItemId?: number;
  /** Только без карточки (общий пул). */
  unlinkedOnly?: boolean;
  page?: number;
  limit?: number;
}

export interface CreateWarehouseItemInput {
  name: string;
  inventoryNumber: string;
  serialNumber?: string;
  status?: WarehouseItemStatus;
  catalogItemId?: number | null;
  purchaseDate?: string | null;
  purchasePrice?: number | null;
  warrantyUntil?: string | null;
  notes?: string | null;
}

export interface BulkCreateWarehouseInput {
  name: string;
  prefix: string;
  startNumber: number;
  count: number;
  padWidth?: number;
  status?: WarehouseItemStatus;
  catalogItemId?: number;
}

export const warehouseApi = {
  list: (params?: WarehouseListParams) =>
    api.get<PaginatedResponse<WarehouseItem>>('/warehouse', { params }).then((r) => r.data),
  byId: (id: number) => api.get<WarehouseItem>(`/warehouse/${id}`).then((r) => r.data),
  create: (data: CreateWarehouseItemInput) =>
    api.post<WarehouseItem>('/warehouse', data).then((r) => r.data),
  bulkCreate: (data: BulkCreateWarehouseInput) =>
    api
      .post<{ created: number; inventoryNumbers: string[] }>('/warehouse/bulk', data)
      .then((r) => r.data),
  update: (id: number, data: Partial<CreateWarehouseItemInput>) =>
    api.patch<WarehouseItem>(`/warehouse/${id}`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/warehouse/${id}`).then((r) => r.data),
  link: (id: number, catalogItemId: number) =>
    api.post<WarehouseItem>(`/warehouse/${id}/link`, { catalogItemId }).then((r) => r.data),
  unlink: (id: number) => api.post<WarehouseItem>(`/warehouse/${id}/unlink`).then((r) => r.data),
  bulkLink: (catalogItemId: number, warehouseItemIds: number[]) =>
    api
      .post<{ linked: number }>('/warehouse/bulk-link', { catalogItemId, warehouseItemIds })
      .then((r) => r.data),
  bulkUnlink: (warehouseItemIds: number[]) =>
    api
      .post<{ unlinked: number }>('/warehouse/bulk-unlink', { warehouseItemIds })
      .then((r) => r.data),
  bulkStatus: (warehouseItemIds: number[], status: WarehouseItemStatus) =>
    api
      .post<{ updated: number }>('/warehouse/bulk-status', { warehouseItemIds, status })
      .then((r) => r.data),
};

// === CLIENTS ===
export interface ClientListParams {
  search?: string;
  clientType?: 'INDIVIDUAL' | 'COMPANY';
  page?: number;
  limit?: number;
}

export const clientsApi = {
  list: (params?: ClientListParams) =>
    api.get<PaginatedResponse<Client>>('/clients', { params }).then((r) => r.data),
  byId: (id: number) => api.get<Client>(`/clients/${id}`).then((r) => r.data),
  create: (data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<Client>('/clients', data).then((r) => r.data),
  update: (id: number, data: Partial<Client>) =>
    api.put<Client>(`/clients/${id}`, data).then((r) => r.data),
};

// === ORDERS ===
export interface OrderListParams {
  status?: OrderStatus;
  source?: OrderSource;
  from?: string;
  to?: string;
  clientId?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateInquiryInput {
  name: string;
  phone: string;
  email?: string;
  equipmentId?: number;
  message?: string;
}

export interface ExtendOrderLineInput {
  newToDate: string;
  note?: string;
}

export interface OrderLineInput {
  equipmentId: number;
  qty: number;
  unitTag?: string;
  warehouseItemId?: number;
}

export interface OrderCreateInput {
  clientId: number;
  fromDate: string;
  toDate: string;
  deliveryMethod: 'PICKUP' | 'DELIVERY';
  address?: string;
  contactPhone: string;
  contactEmail?: string;
  deposit?: number;
  notes?: string;
  lines: OrderLineInput[];
}

export interface UpdateOrderLineInput {
  equipmentId?: number;
  qty?: number;
  unitTag?: string;
  warehouseItemId?: number | null;
}

export const ordersApi = {
  list: (params?: OrderListParams) =>
    api.get<PaginatedResponse<Order>>('/orders', { params }).then((r) => r.data),
  byId: (id: number) => api.get<Order>(`/orders/${id}`).then((r) => r.data),
  create: (data: OrderCreateInput) => api.post<Order>('/orders', data).then((r) => r.data),
  update: (id: number, data: Partial<OrderCreateInput>) =>
    api.put<Order>(`/orders/${id}`, data).then((r) => r.data),
  changeStatus: (id: number, status: OrderStatus, note?: string) =>
    api.post<Order>(`/orders/${id}/status`, { status, note }).then((r) => r.data),
  preview: (data: { fromDate: string; toDate: string; lines: OrderLineInput[] }) =>
    api.post<OrderPreviewResult>('/orders/preview', data).then((r) => r.data),
  // inline-редактирование позиций
  addLine: (orderId: number, line: OrderLineInput) =>
    api.post(`/orders/${orderId}/lines`, line).then((r) => r.data),
  updateLine: (orderId: number, lineId: number, data: UpdateOrderLineInput) =>
    api.patch(`/orders/${orderId}/lines/${lineId}`, data).then((r) => r.data),
  removeLine: (orderId: number, lineId: number) =>
    api.delete(`/orders/${orderId}/lines/${lineId}`).then((r) => r.data),
  assignUnit: (orderId: number, lineId: number, warehouseItemId: number) =>
    api
      .post(`/orders/${orderId}/lines/${lineId}/assign-unit`, { warehouseItemId })
      .then((r) => r.data),
  returnLine: (orderId: number, lineId: number) =>
    api.post(`/orders/${orderId}/lines/${lineId}/return`).then((r) => r.data),
  extendLine: (orderId: number, lineId: number, data: ExtendOrderLineInput) =>
    api
      .post<RentalExtension>(`/orders/${orderId}/lines/${lineId}/extend`, data)
      .then((r) => r.data),
  // Публичный (без auth) — заявка с витрины
  createInquiry: (data: CreateInquiryInput) =>
    api.post<Order>('/orders/inquiry', data).then((r) => r.data),
};

// === ME (личный кабинет клиента) ===
export interface UpdateMyProfileInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

export interface ChangeMyPasswordInput {
  currentPassword: string;
  newPassword: string;
}

export const meApi = {
  profile: () => api.get<UserWithClient>('/me').then((r) => r.data),
  updateProfile: (data: UpdateMyProfileInput) =>
    api.patch<UserWithClient>('/me/profile', data).then((r) => r.data),
  changePassword: (data: ChangeMyPasswordInput) =>
    api.patch<{ ok: true }>('/me/password', data).then((r) => r.data),
  orders: (status?: OrderStatus) =>
    api
      .get<{ items: Order[]; total: number }>('/me/orders', { params: { status } })
      .then((r) => r.data),
  order: (id: number) => api.get<Order>(`/me/orders/${id}`).then((r) => r.data),
  cancelOrder: (id: number) => api.post<Order>(`/me/orders/${id}/cancel`).then((r) => r.data),
};

// === CART (server-side) ===
export interface AddCartLineInput {
  catalogItemId: number;
  qty: number;
  fromDate: string;
  toDate: string;
}

export interface UpdateCartLineInput {
  qty?: number;
  fromDate?: string;
  toDate?: string;
}

export interface CheckoutInput {
  clientId?: number;
  clientData?: {
    name: string;
    phone: string;
    email?: string;
  };
  deliveryMethod: 'PICKUP' | 'DELIVERY';
  address?: string;
  contactPhone: string;
  contactEmail?: string;
  notes?: string;
}

export const cartApi = {
  view: () => api.get<CartView>('/cart').then((r) => r.data),
  addLine: (data: AddCartLineInput) => api.post<CartView>('/cart/lines', data).then((r) => r.data),
  updateLine: (idx: number, data: UpdateCartLineInput) =>
    api.patch<CartView>(`/cart/lines/${idx}`, data).then((r) => r.data),
  removeLine: (idx: number) => api.delete<CartView>(`/cart/lines/${idx}`).then((r) => r.data),
  clear: () => api.delete<CartView>('/cart').then((r) => r.data),
  checkout: (data: CheckoutInput) =>
    api.post<{ orderId: number; orderNumber: string }>('/cart/checkout', data).then((r) => r.data),
};

// === ORG SETTINGS ===
export interface OrgSettings {
  id: number;
  overdueCheckEnabled: boolean;
  overdueCheckEveryMinutes: number;
  dailyBriefEnabled: boolean;
  dailyBriefHour: number;
  dailyBriefMinute: number;
  returnReminderEnabled: boolean;
  returnReminderHour: number;
  returnReminderMinute: number;
  returnReminderDaysBefore: number;
  inquiryExpireEnabled: boolean;
  inquiryExpireHour: number;
  inquiryExpireMinute: number;
  inquiryExpireAfterDays: number;
  timezone: string;
  senderName: string;
  senderEmail: string;
  staffEmails: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpSecure: boolean;
  /** Серверный флаг — пароль уже задан (сам пароль не возвращается). */
  smtpPassConfigured: boolean;
  // Контактные реквизиты организации
  orgName: string;
  orgShortName: string;
  orgPhone: string;
  orgEmail: string;
  orgAddress: string;
  orgHours: string;
  /** Относительный путь к загруженному логотипу (от /uploads). null = встроенный SVG. */
  logoPath: string | null;
  /** Заголовок страницы "Условия аренды" (редактируется через "Публичная информация"). */
  rentalTermsTitle: string;
  /** HTML-контент страницы "Условия аренды" (редактируется через "Публичная информация"). */
  rentalTermsContent: string;
  updatedAt: string;
}
/** Публичные контактные реквизиты — без секретов и без расписания. */
export interface OrgContact {
  orgName: string;
  orgShortName: string;
  orgPhone: string;
  orgEmail: string;
  orgAddress: string;
  orgHours: string;
  logoPath: string | null;
  /**
   * Включена ли проверка email кодом при регистрации и сбросе пароля.
   * true → SMTP настроен, идёт полный flow с кодами.
   * false → SMTP не настроен, фронт пропускает шаги верификации
   *         (юзер регистрируется напрямую, сброс пароля без кода).
   */
  emailVerificationEnabled: boolean;
}
export const orgSettingsApi = {
  get: () => api.get<OrgSettings>('/org-settings').then((r) => r.data),
  contact: () => api.get<OrgContact>('/org-settings/contact').then((r) => r.data),
  rentalTerms: () => api.get<{ title: string; content: string }>('/org-settings/rental-terms').then((r) => r.data),
  update: (
    data: Partial<Omit<OrgSettings, 'id' | 'updatedAt' | 'smtpPassConfigured'>> & {
      smtpPass?: string;
    },
  ) => api.patch<OrgSettings>('/org-settings', data).then((r) => r.data),
  testEmail: (to: string) =>
    api
      .post<{ ok: true; messageId?: string }>('/org-settings/test-email', { to })
      .then((r) => r.data),
  uploadLogo: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api
      .post<OrgSettings>('/org-settings/logo', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
  deleteLogo: () => api.delete<OrgSettings>('/org-settings/logo').then((r) => r.data),
};

// === EMAIL TEMPLATES ===
export interface EmailTemplate {
  id: number;
  eventType: string;
  label: string;
  enabled: boolean;
  subject: string;
  bodyHtml: string;
  updatedAt: string;
}
export interface EmailTemplatePreview {
  eventType: string;
  subject: string;
  bodyHtml: string;
}
export const emailTemplatesApi = {
  list: () => api.get<EmailTemplate[]>('/email-templates').then((r) => r.data),
  get: (eventType: string) =>
    api.get<EmailTemplate>(`/email-templates/${eventType}`).then((r) => r.data),
  update: (
    eventType: string,
    data: Partial<Pick<EmailTemplate, 'enabled' | 'subject' | 'bodyHtml'>>,
  ) => api.patch<EmailTemplate>(`/email-templates/${eventType}`, data).then((r) => r.data),
  preview: (eventType: string, values?: Record<string, unknown>) =>
    api
      .post<EmailTemplatePreview>(`/email-templates/${eventType}/preview`, { values })
      .then((r) => r.data),
};

// === LEGAL ===
export interface LegalDocument {
  id: number;
  slug: string;
  title: string;
  content: string;
  updatedAt: string;
}
export interface LegalDocumentSummary {
  id: number;
  slug: string;
  title: string;
  updatedAt: string;
}
export const legalApi = {
  list: () => api.get<LegalDocumentSummary[]>('/legal').then((r) => r.data),
  get: (slug: string) => api.get<LegalDocument>(`/legal/${slug}`).then((r) => r.data),
  update: (slug: string, data: { title: string; content: string }) =>
    api.patch<LegalDocument>(`/legal/${slug}`, data).then((r) => r.data),
};

// === ANALYTICS ===
/** Один резерв на timeline-полосе. */
export interface TimelineReservation {
  id: number;
  fromDate: string;
  toDate: string;
  status: 'PLANNED' | 'ACTIVE' | 'RETURNED';
  orderId: number;
  orderNumber: string;
  orderStatus: OrderStatus;
  clientName: string;
}
/** Одна физическая единица инвентаря в timeline-календаре. */
export interface TimelineUnit {
  id: number;
  inventoryNumber: string;
  status: 'OPERATIONAL' | 'BROKEN' | 'RETIRED';
  reservations: TimelineReservation[];
}
/** Группа единиц по каталожной карточке. */
export interface TimelineGroup {
  catalogItemId: number;
  catalogName: string;
  catalogSku: string;
  photo: string | null;
  units: TimelineUnit[];
}
export interface TimelineResponse {
  from: string;
  to: string;
  items: TimelineGroup[];
  /** Единицы без привязки к каталожной карточке (orphan-инвентарь). */
  unassigned: TimelineUnit[];
}

export const analyticsApi = {
  dashboard: () => api.get<DashboardStats>('/analytics/dashboard').then((r) => r.data),
  revenue: (from?: string, to?: string) =>
    api.get<RevenuePoint[]>('/analytics/revenue', { params: { from, to } }).then((r) => r.data),
  topEquipment: (limit = 6, from?: string, to?: string) =>
    api
      .get<TopEquipmentPoint[]>('/analytics/top-equipment', { params: { limit, from, to } })
      .then((r) => r.data),
  utilization: (from?: string, to?: string) =>
    api
      .get<UtilizationPoint[]>('/analytics/utilization', { params: { from, to } })
      .then((r) => r.data),
  timeline: (from?: string, to?: string, categoryId?: number) =>
    api
      .get<TimelineResponse>('/analytics/timeline', {
        params: { from, to, categoryId },
      })
      .then((r) => r.data),
};

// === NOTIFICATIONS ===
export interface ActivityFeed {
  newOrders: Array<{
    id: number;
    number: string;
    status: OrderStatus;
    source: OrderSource;
    createdAt: string;
    totalAmount: number;
    client: { id: number; name: string } | null;
  }>;
  statusChanges: Array<{
    id: number;
    orderId: number;
    fromStatus: OrderStatus | null;
    toStatus: OrderStatus;
    changedAt: string;
    order: { number: string; client: { name: string } | null };
    changedBy: { id: number; name: string } | null;
  }>;
  newClients: Array<{ id: number; name: string; phone: string; createdAt: string }>;
  since: string;
}

export const notificationsApi = {
  upcomingReturns: (days = 3) =>
    api.get<Order[]>('/notifications/upcoming-returns', { params: { days } }).then((r) => r.data),
  overdue: () => api.get<Order[]>('/notifications/overdue').then((r) => r.data),
  overdueCount: () =>
    api.get<{ count: number }>('/notifications/overdue/count').then((r) => r.data),
  todayPickups: () => api.get<Order[]>('/notifications/today-pickups').then((r) => r.data),
  todayReturns: () => api.get<Order[]>('/notifications/today-returns').then((r) => r.data),
  activity: (hours = 24) =>
    api.get<ActivityFeed>('/notifications/activity', { params: { hours } }).then((r) => r.data),
};

// === USERS (admin only) ===
export interface SystemUser {
  id: number;
  email: string;
  /** Опционально: у legacy seed-админа может быть NULL до первого редактирования. */
  phone: string | null;
  firstName?: string;
  lastName?: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'USER';
  createdAt: string;
  updatedAt: string;
}

export const usersApi = {
  list: () => api.get<SystemUser[]>('/users').then((r) => r.data),
  create: (data: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    password: string;
    role: SystemUser['role'];
  }) => api.post<SystemUser>('/users', data).then((r) => r.data),
  update: (
    id: number,
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      role?: SystemUser['role'];
      password?: string;
    },
  ) => api.put<SystemUser>(`/users/${id}`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/users/${id}`).then((r) => r.data),
};

// === Дополнительные эндпоинты (admin-only удаления) ===
export const adminApi = {
  deleteClient: (id: number) => api.delete(`/clients/${id}`).then((r) => r.data),
  deleteOrder: (id: number) => api.delete(`/orders/${id}`).then((r) => r.data),
};
