import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  adminApi,
  analyticsApi,
  authApi,
  cartApi,
  categoriesApi,
  clientsApi,
  equipmentApi,
  meApi,
  notificationsApi,
  ordersApi,
  orgSettingsApi,
  tiersApi,
  usersApi,
  warehouseApi,
  type AddCartLineInput,
  type CheckoutInput,
  type ClientListParams,
  type CreateCategoryInput,
  type CreateEquipmentInput,
  type CreateInquiryInput,
  type ChangeMyPasswordInput,
  type BulkCreateWarehouseInput,
  type CreateWarehouseItemInput,
  type EquipmentListParams,
  type ExtendOrderLineInput,
  type OrderCreateInput,
  type OrderLineInput,
  type OrderListParams,
  type RegisterInput,
  type SystemUser,
  type UpdateCartLineInput,
  type UpdateMyProfileInput,
  type UpdateOrderLineInput,
  type WarehouseListParams,
} from '../api/endpoints';
import type { Client, OrderStatus } from '../api/types';

// === AUTH ===
export const useMe = () =>
  useQuery({ queryKey: ['auth', 'me'], queryFn: authApi.me, retry: false });

// === ORG CONTACT ===
/**
 * Контактные реквизиты организации для витрины (название, телефон, email и пр.).
 * Эндпоинт публичный — кэшируем надолго, инвалидируется при сохранении в админке.
 */
export const useOrgContact = () =>
  useQuery({
    queryKey: ['org', 'contact'],
    queryFn: orgSettingsApi.contact,
    staleTime: 10 * 60_000,
  });

// === CATEGORIES ===
export const useCategories = () =>
  useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list, staleTime: 5 * 60_000 });

export const useCategoriesTree = (visibleOnly = false) =>
  useQuery({
    queryKey: ['categories', 'tree', visibleOnly],
    queryFn: () => categoriesApi.tree(visibleOnly),
    staleTime: 60_000,
  });

export const useCreateCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCategoryInput) => categoriesApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
};

export const useUpdateCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateCategoryInput> }) =>
      categoriesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
};

export const useDeleteCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => categoriesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
};

export const useBulkAttachEquipmentToCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, equipmentIds }: { categoryId: number; equipmentIds: number[] }) =>
      categoriesApi.bulkAttachEquipment(categoryId, equipmentIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      qc.invalidateQueries({ queryKey: ['equipment'] });
    },
  });
};

export const useBulkMoveEquipmentToCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      targetCategoryId,
      equipmentIds,
    }: {
      targetCategoryId: number;
      equipmentIds: number[];
    }) => categoriesApi.bulkMoveEquipment(targetCategoryId, equipmentIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      qc.invalidateQueries({ queryKey: ['equipment'] });
    },
  });
};

export const useBulkMoveCategories = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      targetParentId,
      categoryIds,
    }: {
      targetParentId: number | null;
      categoryIds: number[];
    }) => categoriesApi.bulkMoveCategories(targetParentId, categoryIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      qc.invalidateQueries({ queryKey: ['equipment'] });
    },
  });
};

export const useCategoriesConfig = () =>
  useQuery({
    queryKey: ['categories', 'config'],
    queryFn: categoriesApi.config,
    staleTime: 5 * 60_000,
  });

// === EQUIPMENT (CATALOG) ===
export const useEquipmentList = (params?: EquipmentListParams) =>
  useQuery({
    queryKey: ['equipment', params],
    queryFn: () => equipmentApi.list(params),
  });

export const useEquipment = (id: number | undefined) =>
  useQuery({
    queryKey: ['equipment', id],
    queryFn: () => equipmentApi.byId(id!),
    enabled: !!id,
  });

export const useEquipmentAvailability = (id: number | undefined, from: string, to: string) =>
  useQuery({
    queryKey: ['equipment', id, 'availability', from, to],
    queryFn: () => equipmentApi.availability(id!, from, to),
    enabled: !!id && !!from && !!to,
  });

export const useCreateEquipment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateEquipmentInput) => equipmentApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipment'] }),
  });
};

export const useUpdateEquipment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateEquipmentInput> }) =>
      equipmentApi.update(id, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['equipment'] });
      qc.invalidateQueries({ queryKey: ['equipment', vars.id] });
    },
  });
};

export const useSetTierPrice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      equipmentId,
      tierId,
      pricePerDay,
    }: {
      equipmentId: number;
      tierId: number;
      pricePerDay: number;
    }) => equipmentApi.setTierPrice(equipmentId, tierId, pricePerDay),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['equipment'] });
      qc.invalidateQueries({ queryKey: ['equipment', vars.equipmentId] });
    },
  });
};

export const useDeleteEquipment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => equipmentApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipment'] }),
  });
};

export const useArchiveEquipment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => equipmentApi.archive(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['equipment'] });
      qc.invalidateQueries({ queryKey: ['equipment', id] });
      qc.invalidateQueries({ queryKey: ['warehouse'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
};

export const useUnarchiveEquipment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => equipmentApi.unarchive(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['equipment'] });
      qc.invalidateQueries({ queryKey: ['equipment', id] });
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
};

export const useUploadEquipmentPhoto = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => equipmentApi.uploadPhoto(id, file),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['equipment'] });
      qc.invalidateQueries({ queryKey: ['equipment', vars.id] });
    },
  });
};

export const useSetEquipmentPhotos = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, photos }: { id: number; photos: string[] }) =>
      equipmentApi.setPhotos(id, photos),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['equipment'] });
      qc.invalidateQueries({ queryKey: ['equipment', vars.id] });
    },
  });
};

// === PRICING TIERS ===
export const useTiers = () =>
  useQuery({ queryKey: ['pricing', 'tiers'], queryFn: tiersApi.list, staleTime: 60_000 });

export const useAddTier = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      closeAtDays,
      discountPercent,
    }: {
      closeAtDays: number;
      discountPercent: number;
    }) => tiersApi.add(closeAtDays, discountPercent),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pricing'] });
      qc.invalidateQueries({ queryKey: ['equipment'] });
    },
  });
};

export const useUpdateTierBoundary = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tierId, maxDays }: { tierId: number; maxDays: number }) =>
      tiersApi.updateBoundary(tierId, maxDays),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pricing'] });
    },
  });
};

export const useDeleteLastTier = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => tiersApi.deleteLast(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pricing'] });
      qc.invalidateQueries({ queryKey: ['equipment'] });
    },
  });
};

export const useRecalculateTier = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tierId, discountPercent }: { tierId: number; discountPercent: number }) =>
      tiersApi.recalculate(tierId, discountPercent),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pricing'] });
      qc.invalidateQueries({ queryKey: ['equipment'] });
    },
  });
};

export const useTierRecalcPreview = () =>
  useMutation({
    mutationFn: ({ tierId, discountPercent }: { tierId: number; discountPercent: number }) =>
      tiersApi.previewRecalculate(tierId, discountPercent),
  });

// === WAREHOUSE ===
export const useWarehouseList = (params?: WarehouseListParams) =>
  useQuery({ queryKey: ['warehouse', params], queryFn: () => warehouseApi.list(params) });

export const useWarehouseItem = (id: number | undefined) =>
  useQuery({
    queryKey: ['warehouse', id],
    queryFn: () => warehouseApi.byId(id!),
    enabled: !!id,
  });

export const useCreateWarehouseItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWarehouseItemInput) => warehouseApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouse'] });
      qc.invalidateQueries({ queryKey: ['equipment'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
};

export const useUpdateWarehouseItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateWarehouseItemInput> }) =>
      warehouseApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouse'] });
      qc.invalidateQueries({ queryKey: ['equipment'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
};

export const useDeleteWarehouseItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => warehouseApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouse'] });
      qc.invalidateQueries({ queryKey: ['equipment'] });
    },
  });
};

export const useBulkLinkWarehouse = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      catalogItemId,
      warehouseItemIds,
    }: {
      catalogItemId: number;
      warehouseItemIds: number[];
    }) => warehouseApi.bulkLink(catalogItemId, warehouseItemIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouse'] });
      qc.invalidateQueries({ queryKey: ['equipment'] });
    },
  });
};

export const useBulkUnlinkWarehouse = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (warehouseItemIds: number[]) => warehouseApi.bulkUnlink(warehouseItemIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouse'] });
      qc.invalidateQueries({ queryKey: ['equipment'] });
    },
  });
};

export const useBulkStatusWarehouse = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      warehouseItemIds,
      status,
    }: {
      warehouseItemIds: number[];
      status: import('../api/types').WarehouseItemStatus;
    }) => warehouseApi.bulkStatus(warehouseItemIds, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouse'] });
      qc.invalidateQueries({ queryKey: ['equipment'] });
    },
  });
};

export const useBulkCreateWarehouse = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: BulkCreateWarehouseInput) => warehouseApi.bulkCreate(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouse'] });
      qc.invalidateQueries({ queryKey: ['equipment'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
};

export const useEquipmentActivationStatus = (id: number | undefined) =>
  useQuery({
    queryKey: ['equipment', id, 'activation-status'],
    queryFn: () => equipmentApi.activationStatus(id!),
    enabled: !!id,
  });

// === CLIENTS ===
export const useClientsList = (params?: ClientListParams) =>
  useQuery({ queryKey: ['clients', params], queryFn: () => clientsApi.list(params) });

export const useClient = (id: number | undefined) =>
  useQuery({
    queryKey: ['clients', id],
    queryFn: () => clientsApi.byId(id!),
    enabled: !!id,
  });

export const useCreateClient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => clientsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
};

export const useUpdateClient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Client> }) =>
      clientsApi.update(id, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['clients', vars.id] });
    },
  });
};

export const useDeleteClient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminApi.deleteClient(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
};

// === USERS (admin only) ===
export const useUsersList = () => useQuery({ queryKey: ['users'], queryFn: usersApi.list });

export const useCreateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof usersApi.create>[0]) => usersApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
};

export const useUpdateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof usersApi.update>[1] }) =>
      usersApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
};

export const useDeleteUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => usersApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
};

export const useDeleteOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminApi.deleteOrder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
};

export type { SystemUser };

// === ORDERS ===
export const useOrdersList = (params?: OrderListParams) =>
  useQuery({ queryKey: ['orders', params], queryFn: () => ordersApi.list(params) });

export const useOrder = (id: number | undefined) =>
  useQuery({ queryKey: ['orders', id], queryFn: () => ordersApi.byId(id!), enabled: !!id });

export const useCreateOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: OrderCreateInput) => ordersApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

export const useUpdateOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<OrderCreateInput> }) =>
      ordersApi.update(id, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['orders', vars.id] });
    },
  });
};

export const useChangeOrderStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, note }: { id: number; status: OrderStatus; note?: string }) =>
      ordersApi.changeStatus(id, status, note),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['orders', vars.id] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['warehouse'] });
    },
  });
};

export const useOrderPreview = () =>
  useMutation({
    mutationFn: (data: { fromDate: string; toDate: string; lines: OrderLineInput[] }) =>
      ordersApi.preview(data),
  });

// Inline-редактирование позиций
export const useAddOrderLine = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, line }: { orderId: number; line: OrderLineInput }) =>
      ordersApi.addLine(orderId, line),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['orders', vars.orderId] });
    },
  });
};

export const useUpdateOrderLine = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      lineId,
      data,
    }: {
      orderId: number;
      lineId: number;
      data: UpdateOrderLineInput;
    }) => ordersApi.updateLine(orderId, lineId, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['orders', vars.orderId] });
    },
  });
};

export const useRemoveOrderLine = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, lineId }: { orderId: number; lineId: number }) =>
      ordersApi.removeLine(orderId, lineId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['orders', vars.orderId] });
    },
  });
};

export const useAssignWarehouseUnit = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      lineId,
      warehouseItemId,
    }: {
      orderId: number;
      lineId: number;
      warehouseItemId: number;
    }) => ordersApi.assignUnit(orderId, lineId, warehouseItemId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['orders', vars.orderId] });
      qc.invalidateQueries({ queryKey: ['warehouse'] });
    },
  });
};

export const useReturnOrderLine = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, lineId }: { orderId: number; lineId: number }) =>
      ordersApi.returnLine(orderId, lineId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['orders', vars.orderId] });
      qc.invalidateQueries({ queryKey: ['warehouse'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
};

export const useExtendOrderLine = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      lineId,
      data,
    }: {
      orderId: number;
      lineId: number;
      data: ExtendOrderLineInput;
    }) => ordersApi.extendLine(orderId, lineId, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['orders', vars.orderId] });
      qc.invalidateQueries({ queryKey: ['warehouse'] });
    },
  });
};

export const useCreateInquiry = () =>
  useMutation({
    mutationFn: (data: CreateInquiryInput) => ordersApi.createInquiry(data),
  });

// === ME (личный кабинет) ===
export const useMyProfile = () =>
  useQuery({ queryKey: ['me', 'profile'], queryFn: meApi.profile, retry: false });

export const useMyOrders = (status?: OrderStatus, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ['me', 'orders', status],
    queryFn: () => meApi.orders(status),
    enabled: options?.enabled ?? true,
  });

export const useMyOrder = (id: number | undefined) =>
  useQuery({
    queryKey: ['me', 'orders', id],
    queryFn: () => meApi.order(id!),
    enabled: !!id,
  });

export const useCancelMyOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => meApi.cancelOrder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me', 'orders'] });
    },
  });
};

export const useUpdateMyProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateMyProfileInput) => meApi.updateProfile(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me', 'profile'] });
      qc.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
};

export const useChangeMyPassword = () =>
  useMutation({
    mutationFn: (data: ChangeMyPasswordInput) => meApi.changePassword(data),
  });

// === Регистрация (с телефоном) ===
export const useRegister = () =>
  useMutation({ mutationFn: (data: RegisterInput) => authApi.register(data) });

// === Восстановление пароля ===
export const useForgotPassword = () =>
  useMutation({ mutationFn: (email: string) => authApi.forgotPassword(email) });

export const useVerifyResetCode = () =>
  useMutation({
    mutationFn: ({ email, code }: { email: string; code: string }) =>
      authApi.verifyResetCode(email, code),
  });

export const useResetPassword = () =>
  useMutation({
    mutationFn: ({
      email,
      code,
      newPassword,
    }: {
      email: string;
      code: string;
      newPassword: string;
    }) => authApi.resetPassword(email, code, newPassword),
  });

// === CART ===
export const useCart = () =>
  useQuery({ queryKey: ['cart'], queryFn: cartApi.view, refetchOnWindowFocus: true });

export const useAddCartLine = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AddCartLineInput) => cartApi.addLine(data),
    onSuccess: (data) => qc.setQueryData(['cart'], data),
  });
};

export const useUpdateCartLine = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ idx, data }: { idx: number; data: UpdateCartLineInput }) =>
      cartApi.updateLine(idx, data),
    onSuccess: (data) => qc.setQueryData(['cart'], data),
  });
};

export const useRemoveCartLine = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (idx: number) => cartApi.removeLine(idx),
    onSuccess: (data) => qc.setQueryData(['cart'], data),
  });
};

export const useClearCart = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => cartApi.clear(),
    onSuccess: (data) => qc.setQueryData(['cart'], data),
  });
};

export const useCheckout = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CheckoutInput) => cartApi.checkout(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cart'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
};

// === ANALYTICS ===
export const useDashboard = () =>
  useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn: analyticsApi.dashboard,
    refetchInterval: 60_000,
  });

export const useRevenue = (from?: string, to?: string) =>
  useQuery({
    queryKey: ['analytics', 'revenue', from, to],
    queryFn: () => analyticsApi.revenue(from, to),
  });

export const useTopEquipment = (limit = 6, from?: string, to?: string) =>
  useQuery({
    queryKey: ['analytics', 'top', limit, from, to],
    queryFn: () => analyticsApi.topEquipment(limit, from, to),
  });

export const useTimeline = (from?: string, to?: string, categoryId?: number) =>
  useQuery({
    queryKey: ['analytics', 'timeline', from, to, categoryId],
    queryFn: () => analyticsApi.timeline(from, to, categoryId),
    staleTime: 15_000,
  });

export const useUtilization = (from?: string, to?: string) =>
  useQuery({
    queryKey: ['analytics', 'utilization', from, to],
    queryFn: () => analyticsApi.utilization(from, to),
  });

// === NOTIFICATIONS ===
export const useUpcomingReturns = (days = 3) =>
  useQuery({
    queryKey: ['notifications', 'upcoming', days],
    queryFn: () => notificationsApi.upcomingReturns(days),
    refetchInterval: 60_000,
  });

export const useOverdueOrders = () =>
  useQuery({
    queryKey: ['notifications', 'overdue'],
    queryFn: notificationsApi.overdue,
    refetchInterval: 60_000,
  });

export const useOverdueCount = () =>
  useQuery({
    queryKey: ['notifications', 'overdue', 'count'],
    queryFn: notificationsApi.overdueCount,
    refetchInterval: 60_000,
  });

export const useTodayPickups = () =>
  useQuery({
    queryKey: ['notifications', 'today-pickups'],
    queryFn: notificationsApi.todayPickups,
    refetchInterval: 60_000,
  });

export const useTodayReturns = () =>
  useQuery({
    queryKey: ['notifications', 'today-returns'],
    queryFn: notificationsApi.todayReturns,
    refetchInterval: 60_000,
  });

export const useActivityFeed = (hours = 24) =>
  useQuery({
    queryKey: ['notifications', 'activity', hours],
    queryFn: () => notificationsApi.activity(hours),
    refetchInterval: 60_000,
  });
